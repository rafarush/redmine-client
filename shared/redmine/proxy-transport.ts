import type { RedmineRequest, RedmineTransport } from './transport'
import { RedmineError } from './transport'

/**
 * Transport de la versión web (F1-T03): habla con el proxy de Nitro, que guarda
 * la clave de API. Ver sdd/01-arquitectura.md › ADR-002.
 */
export class ProxyTransport implements RedmineTransport {
  readonly kind = 'proxy' as const

  private readonly fetchImpl: typeof globalThis.fetch

  constructor(fetchImpl: typeof globalThis.fetch = globalThis.fetch, private readonly base = '') {
    // El navegador exige que `fetch` se llame con `window` como receptor: guardado
    // suelto en una propiedad lanzaría "Illegal invocation". En Node no pasa, así
    // que sin este bind el fallo solo aparece en el navegador.
    this.fetchImpl = fetchImpl.bind(globalThis)
  }

  async request<T>(req: RedmineRequest): Promise<T> {
    const method = req.method ?? 'GET'
    const url = new URL(`${this.base}/api/redmine${req.path}`, globalThis.location?.origin ?? 'http://localhost')

    for (const [key, value] of Object.entries(req.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }

    const isBinary = req.rawBody !== undefined
    const headers: Record<string, string> = { Accept: 'application/json' }

    // El proxy exige esta cabecera en los métodos que escriben (defensa CSRF).
    if (method !== 'GET') headers['X-Requested-With'] = 'redmine-client'
    if (isBinary) headers['Content-Type'] = 'application/octet-stream'
    else if (req.body !== undefined) headers['Content-Type'] = 'application/json'

    const response = await this.fetchImpl(url.toString(), {
      method,
      headers,
      credentials: 'same-origin',
      body: isBinary
        ? req.rawBody as BodyInit
        : req.body === undefined ? undefined : JSON.stringify(req.body),
    })

    if (!response.ok) throw await readError(response)

    if (response.status === 204) return undefined as T
    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }
}

/** Convierte la respuesta fallida en un RedmineError con los mensajes utilizables. */
export async function readError(response: Response): Promise<RedmineError> {
  let messages: string[] = []
  try {
    const body = await response.json() as { errors?: string[], statusMessage?: string, message?: string }
    if (Array.isArray(body.errors)) messages = body.errors
    else if (body.statusMessage) messages = [body.statusMessage]
    else if (body.message) messages = [body.message]
  }
  catch {
    // Sin cuerpo JSON: queda el status, que ya da un mensaje por defecto.
  }
  return new RedmineError(response.status, messages)
}
