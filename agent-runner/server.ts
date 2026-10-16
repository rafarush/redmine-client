import { createHash, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { formatSse, taskRequestSchema } from '../shared/agent/events'
import { aiRequestSchema } from '../shared/ai/contract'
import type { AiHandler } from './ai'
import { ClaudeTextError } from './ai'
import type { EventHub, Scheduler } from './scheduler'

const MAX_BODY = 256 * 1024
const HEARTBEAT_MS = 15_000

export interface RunnerServerOptions {
  token: string
  allowedOrigin: string
  hub: EventHub
  scheduler: Scheduler
  /** Recibe una línea por petición (método, ruta y estado); nunca cabeceras ni cuerpos. */
  log?: (line: string) => void
  /** IA para escribir (F12): mejorar, continuar o proponer campos con `claude -p`. */
  ai?: AiHandler
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

/** Comparación en tiempo constante, para que el tiempo de respuesta no delate el token. */
export function tokenMatches(header: string | undefined, token: string): boolean {
  const match = /^Bearer (.+)$/.exec(header ?? '')
  return match !== null && timingSafeEqual(digest(match[1]!), digest(token))
}

function send(res: ServerResponse, status: number, body?: unknown) {
  if (body === undefined) {
    res.writeHead(status).end()
    return
  }
  res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body))
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      // Pasado el límite se deja de guardar, pero se sigue leyendo para poder responder 413;
      // si insiste muy por encima, se corta la conexión.
      if (size > MAX_BODY * 4) req.destroy()
      else if (size <= MAX_BODY) chunks.push(chunk)
    })
    req.on('end', () => {
      if (size > MAX_BODY) return reject(new Error('too_large'))
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      }
      catch {
        reject(new Error('bad_json'))
      }
    })
    req.on('error', reject)
  })
}

export function createRunnerServer(options: RunnerServerOptions): Server {
  const { token, allowedOrigin, hub, scheduler, ai } = options

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const origin = req.headers.origin
    // Un origen distinto del permitido no recibe CORS ni respuesta útil.
    if (origin !== undefined && origin !== allowedOrigin) return send(res, 403, { error: 'origin_not_allowed' })
    if (origin !== undefined) {
      res.setHeader('access-control-allow-origin', origin)
      res.setHeader('vary', 'Origin')
    }

    if (req.method === 'OPTIONS') {
      if (origin === undefined) return send(res, 403, { error: 'origin_not_allowed' })
      res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')
      res.setHeader('access-control-allow-headers', 'authorization, content-type, last-event-id')
      if (req.headers['access-control-request-private-network']) res.setHeader('access-control-allow-private-network', 'true')
      return send(res, 204)
    }

    if (!tokenMatches(req.headers.authorization, token)) return send(res, 401, { error: 'unauthorized' })

    const url = new URL(req.url ?? '/', 'http://localhost')

    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, busy: scheduler.busy })
    }

    if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'connection': 'keep-alive' })
      const after = Number(req.headers['last-event-id'] ?? 0)
      for (const event of hub.since(Number.isFinite(after) ? after : 0)) res.write(formatSse(event))
      const unsubscribe = hub.subscribe(event => res.write(formatSse(event)))
      const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS)
      req.on('close', () => {
        clearInterval(heartbeat)
        unsubscribe()
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/tasks') {
      let body: unknown
      try {
        body = await readJson(req)
      }
      catch (error) {
        return send(res, error instanceof Error && error.message === 'too_large' ? 413 : 400, { error: 'bad_request' })
      }
      const parsed = taskRequestSchema.safeParse(body)
      if (!parsed.success) return send(res, 400, { error: 'invalid_task' })
      if (!scheduler.start(parsed.data)) return send(res, 409, { error: 'busy' })
      return send(res, 202, { id: parsed.data.id })
    }

    if (req.method === 'POST' && url.pathname === '/ai/complete') {
      if (!ai) return send(res, 501, { error: 'ai_disabled' })
      let body: unknown
      try {
        body = await readJson(req)
      }
      catch (error) {
        return send(res, error instanceof Error && error.message === 'too_large' ? 413 : 400, { error: 'bad_request' })
      }
      const parsed = aiRequestSchema.safeParse(body)
      if (!parsed.success) return send(res, 400, { error: 'invalid_request' })
      // Si la app cierra la petición (popover cerrado), se mata `claude`.
      const controller = new AbortController()
      // El `close` de la petición salta al leer el cuerpo; el de la respuesta, si el cliente se va.
      res.on('close', () => {
        if (!res.writableEnded) controller.abort()
      })
      try {
        return send(res, 200, await ai(parsed.data, controller.signal))
      }
      catch (error) {
        if (controller.signal.aborted) return res.destroy()
        const status = error instanceof ClaudeTextError ? error.status : 502
        return send(res, status, { error: 'ai_failed', message: error instanceof Error ? error.message : 'Error de la IA' })
      }
    }

    const cancel = /^\/tasks\/([^/]+)\/cancel$/.exec(url.pathname)
    if (req.method === 'POST' && cancel) {
      return scheduler.cancel(decodeURIComponent(cancel[1]!)) ? send(res, 204) : send(res, 404, { error: 'not_running' })
    }

    return send(res, 404, { error: 'not_found' })
  }

  return createServer((req, res) => {
    res.on('finish', () => options.log?.(`${req.method} ${(req.url ?? '').split('?')[0]} ${res.statusCode}`))
    handle(req, res).catch(() => {
      if (!res.headersSent) send(res, 500, { error: 'internal' })
      else res.end()
    })
  })
}
