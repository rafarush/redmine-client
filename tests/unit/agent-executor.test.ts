// @vitest-environment node
import type { EmitInput } from '../../agent-runner/types'
import type { Exec, ExecResult } from '../../agent-runner/executor'
import { describe, expect, it } from 'vitest'
import { agentPrompt, branchName, createExecutor, describeStreamLine, hasAttribution, slugify, stripAttribution } from '../../agent-runner/executor'

const task = { id: 't1', issueId: 42, title: 'Login roto con tildes', description: 'Falla con "José".', comments: ['Pasa en producción'], baseBranch: 'main' }
const ok = (stdout = ''): ExecResult => ({ code: 0, stdout, stderr: '' })

/** git, claude y gh falsos: cada llamada se apunta y responde según `responses`. */
function fakeExec(options: { status?: string, log?: string, verifyFails?: string, claudeResult?: object, prOut?: string } = {}) {
  const calls: string[] = []
  let committed = false
  const exec: Exec = async (command, args, { onLine, shell }) => {
    const line = shell ? command : `${command} ${args.join(' ')}`
    calls.push(line)
    if (command === 'git' && args[0] === 'status') return ok(committed ? '' : (options.status ?? ''))
    if (command === 'git' && args[0] === 'rev-parse') return { code: 1, stdout: '', stderr: '' }
    if (command === 'git' && args[0] === 'log') return ok(options.log ?? '#42: arregla el login\x1e')
    if (command === 'git' && args[0] === 'commit') {
      committed = true
      return ok()
    }
    if (command === 'claude') {
      onLine?.(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Leyendo el código' }, { type: 'tool_use', name: 'Edit' }] } }))
      onLine?.(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'Hecho', ...options.claudeResult }))
      return ok()
    }
    if (shell && command === options.verifyFails) return { code: 1, stdout: 'test fallido', stderr: '' }
    if (command === 'gh') return ok(options.prOut ?? 'https://github.com/org/repo/pull/7\n')
    return ok()
  }
  return { exec, calls }
}

async function run(fake: ReturnType<typeof fakeExec>, verifyCommands = ['pnpm lint', 'pnpm test']) {
  const events: EmitInput[] = []
  const executor = createExecutor({ repoPath: '/repo', verifyCommands, permissionMode: 'acceptEdits', allowedTools: ['Read', 'Edit'], exec: fake.exec })
  let error: unknown
  try {
    await executor.run(task, { emit: e => events.push(e), signal: new AbortController().signal })
  }
  catch (e) {
    error = e
  }
  return { events, error }
}

describe('flujo del agente', () => {
  it('rama, claude, verificación, push y PR', async () => {
    const fake = fakeExec()
    const { events, error } = await run(fake)
    expect(error).toBeUndefined()
    expect(fake.calls).toContain('git checkout -b agent/42-login-roto-con-tildes')
    const claude = fake.calls.find(c => c.startsWith('claude'))!
    expect(claude).toContain('--output-format stream-json')
    expect(claude).toContain('"attribution":{"commit":"","pr":""}')
    expect(fake.calls).toContain('pnpm lint')
    expect(fake.calls).toContain('git push -u origin agent/42-login-roto-con-tildes')
    expect(fake.calls.find(c => c.startsWith('gh pr create'))).toContain('--title #42: Login roto con tildes')
    expect(events.filter(e => e.type === 'log').map(e => e.line)).toContain('Leyendo el código → Edit')
    expect(events.find(e => e.phase === 'testing')).toBeDefined()
    expect(events.at(-1)).toMatchObject({ phase: 'pr_opened', prUrl: 'https://github.com/org/repo/pull/7', branch: 'agent/42-login-roto-con-tildes' })
    expect(fake.calls.at(-1)).toBe('git checkout main')
  })

  it('un árbol sucio se rechaza sin tocar nada', async () => {
    const fake = fakeExec({ status: ' M archivo.ts' })
    const { error } = await run(fake)
    expect((error as Error).message).toContain('cambios sin guardar')
    expect(fake.calls.some(c => c.startsWith('claude'))).toBe(false)
  })

  it('un commit con coautoría se reescribe antes del push', async () => {
    const fake = fakeExec({ log: '#42: arregla el login\n\nCo-Authored-By: Claude <noreply@anthropic.com>\x1e' })
    const { events, error } = await run(fake)
    expect(error).toBeUndefined()
    const reset = fake.calls.indexOf('git reset --soft main')
    const push = fake.calls.findIndex(c => c.startsWith('git push'))
    expect(reset).toBeGreaterThan(-1)
    expect(reset).toBeLessThan(push)
    const commit = fake.calls.find(c => c.startsWith('git commit -m'))!
    expect(commit).not.toMatch(/co-authored-by/i)
    expect(events.some(e => e.line === 'Se quitó la firma del agente de los commits')).toBe(true)
  })

  it('si la verificación falla queda bloqueada y no se empuja', async () => {
    const fake = fakeExec({ verifyFails: 'pnpm test' })
    const { error } = await run(fake)
    expect((error as Error).message).toBe('No pasa la verificación: pnpm test')
    expect(fake.calls.some(c => c.startsWith('git push'))).toBe(false)
  })

  it('sin commits o con error de claude no sigue', async () => {
    expect((await run(fakeExec({ log: '' }))).error).toBeInstanceOf(Error)
    expect(((await run(fakeExec({ claudeResult: { is_error: true, subtype: 'error', result: 'Sin permisos' } }))).error as Error).message).toBe('Sin permisos')
  })
})

describe('programas que faltan', () => {
  it('sin gh se dice qué instalar', async () => {
    const base = fakeExec()
    const exec: Exec = async (command, args, options) => {
      if (command === 'gh') throw Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT' })
      return base.exec(command, args, options)
    }
    const { error } = await run({ exec, calls: base.calls })
    expect((error as Error).message).toContain('gh auth login')
  })
})

describe('piezas', () => {
  it('nombres de rama', () => {
    expect(slugify('¿Arreglar el Login? — ya')).toBe('arreglar-el-login-ya')
    expect(branchName({ issueId: 7, title: '!!!' })).toBe('agent/7-tarea')
  })

  it('firma del agente', () => {
    const message = '#1: algo\n\n🤖 Generated with [Claude Code](https://claude.com)\n\nCo-Authored-By: Claude <x>'
    expect(hasAttribution(message)).toBe(true)
    expect(stripAttribution(message)).toBe('#1: algo')
    expect(hasAttribution('#1: algo limpio')).toBe(false)
  })

  it('prompt y stream-json', () => {
    expect(agentPrompt(task)).toContain('#42: ')
    expect(agentPrompt(task)).toContain('- Pasa en producción')
    expect(describeStreamLine('no json')).toEqual({})
    expect(describeStreamLine(JSON.stringify({ type: 'result', subtype: 'success', result: 'ok' }))).toEqual({ result: { isError: false, text: 'ok' } })
  })
})
