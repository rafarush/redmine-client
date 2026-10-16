// @vitest-environment node
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { SseParser, parseRunnerEvent } from '../../shared/agent/events'
import { parseRunnerConfig } from '../../agent-runner/config'
import { EventHub, Scheduler } from '../../agent-runner/scheduler'
import { createRunnerServer, tokenMatches } from '../../agent-runner/server'
import type { TaskExecutor } from '../../agent-runner/types'

const TOKEN = 'secret-token'
const ORIGIN = 'http://localhost:3000'
const task = { id: 't1', issueId: 7, title: 'Arreglar', description: '', comments: [], baseBranch: 'main' }

let server: Server | undefined
afterEach(() => new Promise<void>(resolve => server ? server.close(() => resolve()) : resolve()))

async function start(executor: TaskExecutor, lines: string[] = []) {
  const hub = new EventHub()
  const scheduler = new Scheduler(hub, executor)
  server = createRunnerServer({ token: TOKEN, allowedOrigin: ORIGIN, hub, scheduler, log: l => lines.push(l) })
  await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve))
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, hub }
}

const auth = { authorization: `Bearer ${TOKEN}` }
const post = (url: string, body: unknown, headers: Record<string, string> = auth) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const waitFor = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await sleep(10)
}

describe('seguridad del runner', () => {
  const idle: TaskExecutor = { run: () => Promise.resolve() }

  it('sin token o con token malo responde 401', async () => {
    const { base } = await start(idle)
    expect((await fetch(`${base}/health`)).status).toBe(401)
    expect((await fetch(`${base}/health`, { headers: { authorization: 'Bearer otro' } })).status).toBe(401)
    expect((await fetch(`${base}/health`, { headers: auth })).status).toBe(200)
  })

  it('otro origen no recibe cabeceras CORS y el permitido sí', async () => {
    const { base } = await start(idle)
    const bad = await fetch(`${base}/health`, { headers: { ...auth, origin: 'http://evil.example.com' } })
    expect(bad.status).toBe(403)
    expect(bad.headers.get('access-control-allow-origin')).toBeNull()
    const preflight = await fetch(`${base}/tasks`, { method: 'OPTIONS', headers: { origin: ORIGIN } })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    const evilPreflight = await fetch(`${base}/tasks`, { method: 'OPTIONS', headers: { origin: 'http://evil.example.com' } })
    expect(evilPreflight.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('el token no aparece en el log de peticiones', async () => {
    const lines: string[] = []
    const { base } = await start(idle, lines)
    await fetch(`${base}/health?token=${TOKEN}`, { headers: auth })
    await waitFor(() => lines.length > 0)
    expect(lines.join('\n')).not.toContain(TOKEN)
    expect(lines[0]).toBe('GET /health 200')
  })

  it('compara el token en tiempo constante y exige el prefijo Bearer', () => {
    expect(tokenMatches(`Bearer ${TOKEN}`, TOKEN)).toBe(true)
    expect(tokenMatches(TOKEN, TOKEN)).toBe(false)
    expect(tokenMatches(undefined, TOKEN)).toBe(false)
  })

  it('rechaza tareas inválidas, ramas peligrosas y cuerpos enormes', async () => {
    const { base } = await start(idle)
    expect((await post(`${base}/tasks`, { id: 'x' })).status).toBe(400)
    expect((await post(`${base}/tasks`, { ...task, baseBranch: '--upload-pack=evil' })).status).toBe(400)
    expect((await post(`${base}/tasks`, { ...task, baseBranch: 'a..b' })).status).toBe(400)
    expect((await post(`${base}/tasks`, { ...task, description: 'x'.repeat(300_000) })).status).toBe(413)
  })
})

describe('ejecución', () => {
  it('emite las fases y solo admite una tarea a la vez', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const executor: TaskExecutor = {
      run: async (_task, ctx) => {
        ctx.emit({ type: 'log', line: 'trabajando' })
        await gate
        ctx.emit({ type: 'phase', phase: 'pr_opened', prUrl: 'https://example.com/pr/1', branch: 'agent/7-arreglar' })
      },
    }
    const { base, hub } = await start(executor)
    expect((await post(`${base}/tasks`, task)).status).toBe(202)
    expect((await post(`${base}/tasks`, { ...task, id: 't2' })).status).toBe(409)
    expect(await (await fetch(`${base}/health`, { headers: auth })).json()).toEqual({ ok: true, busy: true })
    release()
    await waitFor(() => hub.since(0).some(e => e.phase === 'pr_opened'))
    expect(hub.since(0).map(e => e.phase ?? e.line)).toEqual(['working', 'trabajando', 'pr_opened'])
    // Al terminar, el runner queda libre para la siguiente tarea.
    let status = 409
    for (let i = 0; i < 100 && status === 409; i++) {
      status = (await post(`${base}/tasks`, { ...task, id: 't3' })).status
      if (status === 409) await sleep(10)
    }
    expect(status).toBe(202)
  })

  it('un error del ejecutor deja la tarea bloqueada con el motivo', async () => {
    const { base, hub } = await start({ run: () => Promise.reject(new Error('falló lint')) })
    await post(`${base}/tasks`, task)
    await waitFor(() => hub.since(0).some(e => e.phase === 'blocked'))
    expect(hub.since(0).at(-1)).toMatchObject({ phase: 'blocked', reason: 'falló lint', taskId: 't1' })
  })

  it('terminar sin PR también es un bloqueo', async () => {
    const { base, hub } = await start({ run: () => Promise.resolve() })
    await post(`${base}/tasks`, task)
    await waitFor(() => hub.since(0).some(e => e.phase === 'blocked'))
    expect(hub.since(0).at(-1)!.phase).toBe('blocked')
  })

  it('cancelar aborta la señal y emite cancelled', async () => {
    const executor: TaskExecutor = {
      run: (_task, ctx) => new Promise((_resolve, reject) => ctx.signal.addEventListener('abort', () => reject(new Error('abortado')))),
    }
    const { base, hub } = await start(executor)
    await post(`${base}/tasks`, task)
    expect((await post(`${base}/tasks/otra/cancel`, {})).status).toBe(404)
    expect((await post(`${base}/tasks/t1/cancel`, {})).status).toBe(204)
    await waitFor(() => hub.since(0).some(e => e.phase === 'cancelled'))
    expect(hub.since(0).at(-1)!.phase).toBe('cancelled')
  })

  it('el SSE reenvía el histórico y los eventos nuevos', async () => {
    const { base, hub } = await start({ run: () => Promise.resolve() })
    hub.emit('t0', { type: 'log', line: 'antes' })
    const controller = new AbortController()
    const res = await fetch(`${base}/events`, { headers: auth, signal: controller.signal })
    expect(res.headers.get('content-type')).toBe('text/event-stream')
    const parser = new SseParser()
    const seen: string[] = []
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    hub.emit('t0', { type: 'log', line: 'después' })
    while (seen.length < 2) {
      const { value } = await reader.read()
      seen.push(...parser.push(decoder.decode(value)).map(e => e.line!))
    }
    controller.abort()
    expect(seen).toEqual(['antes', 'después'])
  })
})

describe('eventos y config', () => {
  it('SseParser une trozos partidos y descarta basura', () => {
    const parser = new SseParser()
    const event = { id: 1, taskId: 't', type: 'log', line: 'hola' }
    const text = `id: 1\nevent: log\ndata: ${JSON.stringify(event)}\n\n: ping\n\ndata: {no json}\n\n`
    const half = Math.floor(text.length / 2)
    expect(parser.push(text.slice(0, half))).toEqual([])
    expect(parser.push(text.slice(half))).toEqual([event])
  })

  it('parseRunnerEvent rechaza fases desconocidas', () => {
    expect(parseRunnerEvent(JSON.stringify({ id: 1, taskId: 't', type: 'phase', phase: 'rara' }))).toBeUndefined()
  })

  it('parseRunnerConfig aplica valores por defecto y rechaza lo inválido', () => {
    const config = parseRunnerConfig({ repoPath: '.' })
    expect(config).toMatchObject({ port: 4317, allowedOrigin: ORIGIN })
    expect(config.verifyCommands).toContain('pnpm test')
    expect(() => parseRunnerConfig({})).toThrow(/repoPath/)
    expect(() => parseRunnerConfig({ repoPath: '.', port: 80 })).toThrow(/port/)
  })
})
