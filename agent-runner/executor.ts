import type { TaskRequest } from '../shared/agent/events'
import type { TaskContext, TaskExecutor } from './types'
import { spawn } from 'node:child_process'

/**
 * El flujo de una tarea de la cola (F11-T03, ADR-009):
 *
 * 1. Árbol limpio o nada (no se mezcla trabajo a medias de nadie).
 * 2. Rama `agent/<id>-<slug>` desde la rama base actualizada.
 * 3. `claude -p` con la tarea, `stream-json` → eventos `log`, atribución vacía.
 * 4. Sin `Co-Authored-By` ni "Generated with": si aparecen, se reescriben los commits.
 * 5. Fase `testing`: los comandos de verificación de la config del runner.
 * 6. `git push` y `gh pr create` → fase `pr_opened` con la URL.
 *
 * Los comandos llegan inyectados (`exec`) para probar el flujo sin git ni claude reales.
 */

export interface ExecResult { code: number, stdout: string, stderr: string }
export interface ExecOptions {
  cwd: string
  signal: AbortSignal
  /** Entrada estándar (el prompt de claude). */
  input?: string
  /** Cada línea de stdout según llega (para el log de claude). */
  onLine?: (line: string) => void
  /** Ejecutar con shell: solo para los comandos de verificación de la config. */
  shell?: boolean
}
export type Exec = (command: string, args: string[], options: ExecOptions) => Promise<ExecResult>

export interface ExecutorOptions {
  repoPath: string
  verifyCommands: string[]
  /** Modo de permisos de claude y herramientas que puede usar sin preguntar. */
  permissionMode: string
  allowedTools: string[]
  exec?: Exec
  claudeCommand?: string
}

/** `spawn` real, cancelable, con stdout por líneas. */
export const realExec: Exec = (command, args, { cwd, signal, input, onLine, shell }) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd, shell, windowsHide: true, signal })
  let stdout = ''
  let stderr = ''
  let pending = ''
  child.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8')
    stdout += text
    if (!onLine) return
    pending += text
    const lines = pending.split('\n')
    pending = lines.pop() ?? ''
    for (const line of lines) if (line.trim()) onLine(line)
  })
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8')
  })
  child.on('error', reject)
  child.on('close', (code) => {
    if (onLine && pending.trim()) onLine(pending)
    resolve({ code: code ?? 1, stdout, stderr })
  })
  if (input !== undefined) child.stdin.end(input)
  else child.stdin.end()
})

/** "Login roto con tildes" → "login-roto-con-tildes" (corto, sin acentos). */
export function slugify(title: string): string {
  return title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'tarea'
}

export function branchName(task: Pick<TaskRequest, 'issueId' | 'title'>): string {
  return `agent/${task.issueId}-${slugify(task.title)}`
}

/** Líneas de firma del agente que no deben llegar al repo. */
const ATTRIBUTION = [/^\s*co-authored-by:/i, /generated with/i, /🤖/]

export function hasAttribution(message: string): boolean {
  return message.split('\n').some(line => ATTRIBUTION.some(re => re.test(line)))
}

export function stripAttribution(message: string): string {
  return message.split('\n').filter(line => !ATTRIBUTION.some(re => re.test(line))).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** Instrucciones para el agente: la tarea, sus comentarios y las reglas del repo. */
export function agentPrompt(task: TaskRequest): string {
  const comments = task.comments.length
    ? `\n\n## Comentarios de la tarea\n\n${task.comments.map(c => `- ${c.replaceAll('\n', '\n  ')}`).join('\n')}`
    : ''
  return `Implementa la tarea #${task.issueId} de Redmine en este repositorio.

## ${task.title}

${task.description.trim() || '(sin descripción)'}${comments}

## Cómo trabajar

- Sigue las instrucciones del repositorio (CLAUDE.md y documentación) si existen.
- Haz los cambios mínimos y completos para la tarea, con tests si el repositorio los usa.
- Haz commit de tu trabajo en la rama actual (no cambies de rama ni hagas push). El mensaje empieza por "#${task.issueId}: ".
- No añadas líneas Co-Authored-By ni "Generated with" a los commits.
- Si no puedes completar la tarea, explica por qué en tu último mensaje.`
}

/** Una línea de `stream-json` → texto para el log, o nada si no hay nada que enseñar. */
export function describeStreamLine(line: string): { log?: string, result?: { isError: boolean, text: string } } {
  let data: { type?: string, subtype?: string, is_error?: boolean, result?: string, message?: { content?: { type: string, text?: string, name?: string }[] } }
  try {
    data = JSON.parse(line)
  }
  catch {
    return {}
  }
  if (data.type === 'result') return { result: { isError: data.is_error === true || data.subtype !== 'success', text: data.result ?? '' } }
  if (data.type === 'assistant') {
    const parts = data.message?.content ?? []
    const text = parts.flatMap(p => p.type === 'text' && p.text?.trim() ? [p.text.trim()] : p.type === 'tool_use' && p.name ? [`→ ${p.name}`] : []).join(' ')
    return text ? { log: text.length > 500 ? `${text.slice(0, 500)}…` : text } : {}
  }
  return {}
}

export function createExecutor(options: ExecutorOptions): TaskExecutor {
  const exec = options.exec ?? realExec
  const cwd = options.repoPath

  return {
    async run(task: TaskRequest, ctx: TaskContext) {
      const { signal, emit } = ctx
      const log = (line: string) => emit({ type: 'log', line })
      const git = async (args: string[], allowFail = false) => {
        const result = await exec('git', args, { cwd, signal })
        if (result.code !== 0 && !allowFail) throw new Error(`git ${args[0]} falló: ${(result.stderr || result.stdout).trim().split('\n').at(-1) ?? ''}`)
        return result
      }

      // 1. Árbol limpio.
      const status = await git(['status', '--porcelain'])
      if (status.stdout.trim()) throw new Error('El repositorio tiene cambios sin guardar: el agente no empieza sobre trabajo a medias.')

      // 2. Rama desde la base, actualizada si hay remoto.
      await git(['checkout', task.baseBranch])
      await git(['pull', '--ff-only'], true)
      let branch = branchName(task)
      for (let n = 2; (await git(['rev-parse', '--verify', '--quiet', branch], true)).code === 0; n++) branch = `${branchName(task)}-${n}`
      await git(['checkout', '-b', branch])
      emit({ type: 'log', line: `Rama ${branch} desde ${task.baseBranch}`, branch })

      try {
        // 3. El agente.
        let outcome: { isError: boolean, text: string } | undefined
        const claude = await exec(options.claudeCommand ?? 'claude', [
          '-p',
          '--output-format', 'stream-json',
          '--verbose',
          '--no-session-persistence',
          '--permission-mode', options.permissionMode,
          '--allowedTools', ...options.allowedTools,
          // Atribución vacía: ni Co-Authored-By en los commits ni firma en la PR.
          '--settings', JSON.stringify({ attribution: { commit: '', pr: '' }, includeCoAuthoredBy: false }),
        ], {
          cwd,
          signal,
          input: agentPrompt(task),
          onLine: (line) => {
            const described = describeStreamLine(line)
            if (described.log) log(described.log)
            if (described.result) outcome = described.result
          },
        })
        if (claude.code !== 0 || !outcome || outcome.isError) {
          throw new Error(outcome?.text?.slice(0, 300) || `claude terminó con código ${claude.code}`)
        }

        // 4. Commits del agente, sin firma.
        const range = `${task.baseBranch}..HEAD`
        const messages = (await git(['log', range, '--format=%B%x1e'])).stdout.split('\x1E').map(m => m.trim()).filter(Boolean)
        if (messages.length === 0) throw new Error(`El agente no hizo ningún commit. ${outcome.text.slice(0, 200)}`.trim())
        if (messages.some(hasAttribution)) {
          // Se juntan en uno con los mensajes limpios: lo importante es que no lleguen firmados.
          const cleaned = messages.reverse().map(stripAttribution).filter(Boolean).join('\n\n')
          await git(['reset', '--soft', task.baseBranch])
          await git(['commit', '-m', cleaned || `#${task.issueId}: ${task.title}`])
          log('Se quitó la firma del agente de los commits')
        }
        const dirty = await git(['status', '--porcelain'])
        if (dirty.stdout.trim()) log('Quedaron cambios sin commit; no se incluyen en la PR')

        // 5. Verificación.
        emit({ type: 'phase', phase: 'testing', branch })
        for (const command of options.verifyCommands) {
          log(`$ ${command}`)
          const result = await exec(command, [], { cwd, signal, shell: true })
          if (result.code !== 0) {
            const tail = `${result.stdout}\n${result.stderr}`.trim().split('\n').slice(-15).join('\n')
            log(tail)
            throw new Error(`No pasa la verificación: ${command}`)
          }
        }

        // 6. Push y PR.
        await git(['push', '-u', 'origin', branch])
        const body = `Tarea de Redmine #${task.issueId}.\n\n${task.description.trim().slice(0, 4_000)}`
        const pr = await exec('gh', ['pr', 'create', '--base', task.baseBranch, '--head', branch, '--title', `#${task.issueId}: ${task.title}`, '--body', body], { cwd, signal })
        if (pr.code !== 0) throw new Error(`No se pudo abrir la PR: ${(pr.stderr || pr.stdout).trim().split('\n').at(-1) ?? ''}`)
        const prUrl = /https?:\/\/\S+/.exec(pr.stdout)?.[0]
        emit({ type: 'phase', phase: 'pr_opened', branch, prUrl })
      }
      finally {
        // La siguiente tarea vuelve a partir de la base; la rama queda para revisar.
        await exec('git', ['checkout', task.baseBranch], { cwd, signal: new AbortController().signal }).catch(() => undefined)
      }
    },
  }
}
