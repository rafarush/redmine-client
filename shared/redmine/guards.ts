/**
 * Comprobaciones de seguridad del proxy, sin dependencias de Nitro para poder
 * probarlas sueltas (F1-T02). Ver sdd/01-arquitectura.md › Seguridad.
 */

/** Quita la barra final y añade el esquema si falta. Lanza si no es una URL válida. */
export function normalizeUrl(input: string): string {
  const text = input.trim()
  if (!text) throw new Error('La URL está vacía.')

  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`
  const url = new URL(withScheme)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('La URL debe empezar por http:// o https://')
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
}

/**
 * ¿Está el host de `url` en la lista permitida?
 *
 * Sin lista configurada no se permite nada: es preferible que el proxy falle a que
 * quede abierto a cualquier destino de la red interna (SSRF).
 */
export function isHostAllowedIn(allowed: string[], url: string): boolean {
  const list = allowed.map(host => host.trim().toLowerCase()).filter(Boolean)
  if (list.length === 0) return false

  let target: URL
  try {
    target = new URL(url)
  }
  catch {
    return false
  }

  // `host` incluye el puerto; `hostname` no. Se aceptan las dos formas en la lista.
  return list.includes(target.host.toLowerCase()) || list.includes(target.hostname.toLowerCase())
}

/** Solo rutas de la API de Redmine: el proxy no es una pasarela de propósito general. */
const ALLOWED_PATHS = [
  /^\/[\w\-/.%]*\.json$/,
  /^\/attachments\/download\/\d+(\/[\w\-.%]+)?$/,
]

export function isPathAllowed(path: string): boolean {
  if (!path.startsWith('/') || path.includes('..') || path.includes('\\')) return false
  return ALLOWED_PATHS.some(pattern => pattern.test(path))
}

/**
 * Quita `api_key` de cualquier profundidad de la respuesta.
 * `/users/current.json` la incluye, y en la versión web nunca debe llegar al navegador.
 */
export function stripApiKey<T>(body: T): T {
  if (Array.isArray(body)) return body.map(stripApiKey) as T
  if (body !== null && typeof body === 'object') {
    return Object.fromEntries(
      Object.entries(body as Record<string, unknown>)
        .filter(([key]) => key !== 'api_key')
        .map(([key, value]) => [key, stripApiKey(value)]),
    ) as T
  }
  return body
}
