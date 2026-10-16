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

    // `fetch` no informa del progreso de subida: para eso se usa XHR (solo navegador).
    if (isBinary && req.onUploadProgress && typeof XMLHttpRequest !== 'undefined') {
      return uploadWithProgress<T>(url.toString(), method, headers, req.rawBody!, req.onUploadProgress, req.signal)
    }

    const response = await this.fetchImpl(url.toString(), {
      method,
      headers,
      credentials: 'same-origin',
      signal: req.signal,
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

/** Subida binaria con progreso y cancelación, con el mismo trato de errores que `request`. */
function uploadWithProgress<T>(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: Blob | ArrayBuffer,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, url)
    xhr.withCredentials = true
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)

    const abort = () => xhr.abort()
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) {
      reject(new DOMException('Subida cancelada', 'AbortError'))
      return
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total)
    }
    xhr.onabort = () => reject(new DOMException('Subida cancelada', 'AbortError'))
    xhr.onerror = () => reject(new RedmineError(0, ['No se pudo contactar con el servidor.']))
    xhr.onload = () => {
      signal?.removeEventListener('abort', abort)
      const response = new Response(xhr.status === 204 ? null : xhr.responseText, {
        status: xhr.status,
        headers: { 'content-type': xhr.getResponseHeader('content-type') ?? '' },
      })
      if (!response.ok) {
        void readError(response).then(reject)
        return
      }
      resolve((xhr.responseText ? JSON.parse(xhr.responseText) : undefined) as T)
    }
    xhr.send(body)
  })
}
