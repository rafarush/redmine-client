import type { RedmineRequest, RedmineTransport } from './transport'
import { RedmineError } from './transport'

/**
 * Transport de la versión web (F1-T03): habla con el proxy de Nitro, que guarda
 * la clave de API. Ver sdd/01-arquitectura.md › ADR-002.
 */
export class ProxyTransport implements RedmineTransport {
  readonly kind = 'proxy' as const

  constructor(private readonly fetchImpl: typeof globalThis.fetch = globalThis.fetch, private readonly base = '') {}

  async request<T>(req: RedmineRequest): Promise<T> {
    const method = req.method ?? 'GET'
    const url = new URL(`${this.base}/api/redmine${req.path}`, globalThis.location?.origin ?? 'http://localhost')

    for (const [clave, valor] of Object.entries(req.query ?? {})) {
      if (valor !== undefined) url.searchParams.set(clave, String(valor))
    }

    const esBinario = req.rawBody !== undefined
    const headers: Record<string, string> = { Accept: 'application/json' }

    // El proxy exige esta cabecera en los métodos que escriben (defensa CSRF).
    if (method !== 'GET') headers['X-Requested-With'] = 'redmine-client'
    if (esBinario) headers['Content-Type'] = 'application/octet-stream'
    else if (req.body !== undefined) headers['Content-Type'] = 'application/json'

    const respuesta = await this.fetchImpl(url.toString(), {
      method,
      headers,
      credentials: 'same-origin',
      body: esBinario
        ? req.rawBody as BodyInit
        : req.body === undefined ? undefined : JSON.stringify(req.body),
    })

    if (!respuesta.ok) throw await leerError(respuesta)

    if (respuesta.status === 204) return undefined as T
    const texto = await respuesta.text()
    return (texto ? JSON.parse(texto) : undefined) as T
  }
}

/** Convierte la respuesta fallida en un RedmineError con los mensajes utilizables. */
export async function leerError(respuesta: Response): Promise<RedmineError> {
  let mensajes: string[] = []
  try {
    const cuerpo = await respuesta.json() as { errors?: string[], statusMessage?: string, message?: string }
    if (Array.isArray(cuerpo.errors)) mensajes = cuerpo.errors
    else if (cuerpo.statusMessage) mensajes = [cuerpo.statusMessage]
    else if (cuerpo.message) mensajes = [cuerpo.message]
  }
  catch {
    // Sin cuerpo JSON: queda el status, que ya da un mensaje por defecto.
  }
  return new RedmineError(respuesta.status, mensajes)
}
