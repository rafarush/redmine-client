// @vitest-environment node
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it } from 'vitest'
import { claudeArgs, ClaudeTextError, createClaudeText, parseClaudeJson } from '../../agent-runner/ai'
import { EventHub, Scheduler } from '../../agent-runner/scheduler'
import { createRunnerServer } from '../../agent-runner/server'
import { aiRequestSchema } from '../../shared/ai/contract'

/** Proceso falso: guarda lo que recibe por stdin y responde lo que se le diga. */
function fakeSpawn(reply: { stdout?: string, stderr?: string, code?: number, never?: boolean }) {
  const calls: { command: string, args: string[], stdin: string }[] = []
  const spawnImpl = (command: string, args: string[]) => {
    const child = new EventEmitter() as ChildProcessWithoutNullStreams
    const stdin = new PassThrough()
    const stdout = new PassThrough()
    const stderr = new PassThrough()
    Object.assign(child, { stdin, stdout, stderr, kill: () => child.emit('close', null) })
    const call = { command, args, stdin: '' }
    calls.push(call)
    stdin.on('data', (chunk: Buffer) => {
      call.stdin += chunk.toString()
    })
    stdin.on('finish', () => {
      if (reply.never) return
      setTimeout(() => {
        if (reply.stdout) stdout.write(reply.stdout)
        if (reply.stderr) stderr.write(reply.stderr)
        child.emit('close', reply.code ?? 0)
      }, 1)
    })
    return child
  }
  return { spawnImpl, calls }
}

const improve = aiRequestSchema.parse({ task: 'improve', text: 'texto feo', instruction: 'Tono académico', model: 'claude-haiku-5-5' })

describe('claude -p como motor', () => {
  it('lanza claude sin herramientas, con el prompt por stdin', async () => {
    const { spawnImpl, calls } = fakeSpawn({ stdout: JSON.stringify({ type: 'result', result: '"Texto mejorado"', is_error: false }) })
    const result = await createClaudeText({ spawnImpl })(improve, new AbortController().signal)
    expect(result).toEqual({ kind: 'text', text: 'Texto mejorado' })
    const args = calls[0]!.args
    expect(args).toContain('-p')
    expect(args[args.indexOf('--tools') + 1]).toBe('')
    expect(args[args.indexOf('--model') + 1]).toBe('claude-haiku-5-5')
    expect(args).toContain('--no-session-persistence')
    expect(calls[0]!.stdin).toContain('<fragmento>\ntexto feo\n</fragmento>')
    expect(args.join(' ')).not.toContain('texto feo')
  })

  it('lee la propuesta de campos', async () => {
    const { spawnImpl } = fakeSpawn({ stdout: JSON.stringify({ result: 'Aquí va: {"tracker":"Errores"}', is_error: false }) })
    const fill = aiRequestSchema.parse({ task: 'fill', subject: 'Login roto', trackers: ['Errores'], priorities: [] })
    expect(await createClaudeText({ spawnImpl })(fill, new AbortController().signal)).toEqual({ kind: 'fill', suggestion: { tracker: 'Errores' } })
  })

  it('un error de claude llega como mensaje', async () => {
    const { spawnImpl } = fakeSpawn({ stdout: JSON.stringify({ result: 'Not logged in', is_error: true }), code: 1 })
    await expect(createClaudeText({ spawnImpl })(improve, new AbortController().signal)).rejects.toThrow('Not logged in')
    expect(() => parseClaudeJson('basura')).toThrow(ClaudeTextError)
  })

  it('cancelar mata el proceso y no resuelve', async () => {
    const { spawnImpl } = fakeSpawn({ never: true })
    const controller = new AbortController()
    const pending = createClaudeText({ spawnImpl })(improve, controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ status: 499 })
  })

  it('el prompt de sistema va como argumento y el modelo es el pedido', () => {
    const args = claudeArgs(improve, 'SISTEMA', 'medium')
    expect(args[args.indexOf('--system-prompt') + 1]).toBe('SISTEMA')
    expect(args[args.indexOf('--effort') + 1]).toBe('medium')
  })
})

describe('ruta /ai/complete', () => {
  let server: Server | undefined
  afterEach(() => new Promise<void>(resolve => server ? server.close(() => resolve()) : resolve()))

  async function start(ai?: Parameters<typeof createRunnerServer>[0]['ai']) {
    const hub = new EventHub()
    server = createRunnerServer({ token: 't0k3n', allowedOrigin: 'http://localhost:3000', hub, scheduler: new Scheduler(hub, { run: () => Promise.resolve() }), ai })
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve))
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/ai/complete`
  }
  const post = (url: string, body: unknown, token = 't0k3n') =>
    fetch(url, { method: 'POST', headers: { 'authorization': `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })

  it('sin token 401, petición mala 400 y bien 200', async () => {
    const url = await start(async request => ({ kind: 'text', text: `ok:${request.task}` }))
    expect((await post(url, { task: 'continue', before: 'hola' }, 'malo')).status).toBe(401)
    expect((await post(url, { task: 'nada' })).status).toBe(400)
    const res = await post(url, { task: 'continue', before: 'hola' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ kind: 'text', text: 'ok:continue' })
  })

  it('sin motor responde 501 y un fallo lleva su mensaje', async () => {
    expect((await post(await start(), { task: 'continue', before: 'hola' })).status).toBe(501)
    await new Promise<void>(resolve => server!.close(() => resolve()))
    const url = await start(async () => {
      throw new ClaudeTextError('No se pudo arrancar Claude Code.', 503)
    })
    const res = await post(url, { task: 'continue', before: 'hola' })
    expect(res.status).toBe(503)
    expect((await res.json()).message).toBe('No se pudo arrancar Claude Code.')
  })
})
