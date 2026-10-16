import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from 'node:child_process'
import type { AiResponse, ParsedAiRequest } from '../shared/ai/contract'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { buildPrompt, cleanImproved, parseFillResponse } from '../shared/ai/prompts'

/**
 * Motor "runner" de la IA para escribir (F12, ADR-010): `claude -p` sin
 * herramientas, sin MCP y sin guardar sesión, en una carpeta temporal (no en el
 * repo). El prompt va por stdin, así que no aparece en la lista de procesos.
 */

export type SpawnFn = (command: string, args: string[], options: SpawnOptionsWithoutStdio) => ChildProcessWithoutNullStreams

export interface ClaudeTextOptions {
  command?: string
  spawnImpl?: SpawnFn
  /** Más que esto y se corta: un texto no debería tardar minutos. */
  timeoutMs?: number
}

export type AiHandler = (request: ParsedAiRequest, signal: AbortSignal) => Promise<AiResponse>

export class ClaudeTextError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message)
  }
}

export function claudeArgs(request: ParsedAiRequest, system: string, effort: string): string[] {
  return [
    '-p',
    '--output-format', 'json',
    '--tools', '',
    '--strict-mcp-config',
    '--no-session-persistence',
    '--model', request.model,
    '--effort', effort,
    '--system-prompt', system,
  ]
}

/** Salida de `claude -p --output-format json` → texto de la respuesta. */
export function parseClaudeJson(stdout: string): string {
  let data: { result?: unknown, is_error?: unknown, subtype?: unknown }
  try {
    data = JSON.parse(stdout.trim().split('\n').filter(Boolean).at(-1) ?? '')
  }
  catch {
    throw new ClaudeTextError('La respuesta de Claude Code no se entiende.')
  }
  if (data.is_error === true || typeof data.result !== 'string') {
    throw new ClaudeTextError(typeof data.result === 'string' && data.result ? data.result : 'Claude Code devolvió un error.')
  }
  return data.result
}

export function createClaudeText(options: ClaudeTextOptions = {}): AiHandler {
  const command = options.command ?? 'claude'
  const spawnImpl = options.spawnImpl ?? (spawn as SpawnFn)
  const timeoutMs = options.timeoutMs ?? 120_000

  return (request, signal) => new Promise<AiResponse>((resolve, reject) => {
    const prompt = buildPrompt(request)
    let child: ChildProcessWithoutNullStreams
    try {
      child = spawnImpl(command, claudeArgs(request, prompt.system, prompt.effort), { cwd: tmpdir(), windowsHide: true })
    }
    catch {
      reject(new ClaudeTextError('No se pudo arrancar Claude Code. ¿Está instalado y en el PATH?', 503))
      return
    }

    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      fn()
    }
    // Primero se da por terminado y luego se mata: el `close` que provoca `kill` ya no cuenta.
    const abort = () => {
      finish(() => reject(new ClaudeTextError('Cancelado', 499)))
      child.kill()
    }
    const timer = setTimeout(() => {
      finish(() => reject(new ClaudeTextError('Claude Code tardó demasiado.', 504)))
      child.kill()
    }, timeoutMs)
    signal.addEventListener('abort', abort, { once: true })

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', () => finish(() => reject(new ClaudeTextError('No se pudo arrancar Claude Code. ¿Está instalado y en el PATH?', 503))))
    child.on('close', (code) => {
      finish(() => {
        try {
          const text = parseClaudeJson(stdout)
          if (request.task === 'fill') {
            const suggestion = parseFillResponse(text)
            if (!suggestion) throw new ClaudeTextError('La respuesta de la IA no se entiende.')
            resolve({ kind: 'fill', suggestion })
          }
          else {
            resolve({ kind: 'text', text: request.task === 'improve' ? cleanImproved(text) : text })
          }
        }
        catch (error) {
          // stderr solo sirve de pista si no hubo respuesta; nunca se reenvía entero.
          reject(error instanceof ClaudeTextError && code === 0 ? error : new ClaudeTextError(stderr.trim().split('\n').at(-1)?.slice(0, 200) || (error as Error).message))
        }
      })
    })

    child.stdin.end(prompt.user)
  })
}
