/**
 * Comprobaciones de seguridad del proxy, sin dependencias de Nitro para poder
 * probarlas sueltas (F1-T02). Ver sdd/01-arquitectura.md › Seguridad.
 */

/** Quita la barra final y añade el esquema si falta. Lanza si no es una URL válida. */
export function normalizarUrl(entrada: string): string {
  const texto = entrada.trim()
  if (!texto) throw new Error('La URL está vacía.')

  const conEsquema = /^https?:\/\//i.test(texto) ? texto : `https://${texto}`
  const url = new URL(conEsquema)
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
export function hostPermitidoEn(permitidos: string[], url: string): boolean {
  const lista = permitidos.map(host => host.trim().toLowerCase()).filter(Boolean)
  if (lista.length === 0) return false

  let destino: URL
  try {
    destino = new URL(url)
  }
  catch {
    return false
  }

  // `host` incluye el puerto; `hostname` no. Se aceptan las dos formas en la lista.
  return lista.includes(destino.host.toLowerCase()) || lista.includes(destino.hostname.toLowerCase())
}

/** Solo rutas de la API de Redmine: el proxy no es una pasarela de propósito general. */
const RUTAS_PERMITIDAS = [
  /^\/[\w\-/.%]*\.json$/,
  /^\/attachments\/download\/\d+(\/[\w\-.%]+)?$/,
]

export function rutaEstaPermitida(path: string): boolean {
  if (!path.startsWith('/') || path.includes('..') || path.includes('\\')) return false
  return RUTAS_PERMITIDAS.some(patron => patron.test(path))
}

/**
 * Quita `api_key` de cualquier profundidad de la respuesta.
 * `/users/current.json` la incluye, y en la versión web nunca debe llegar al navegador.
 */
export function quitarApiKey<T>(cuerpo: T): T {
  if (Array.isArray(cuerpo)) return cuerpo.map(quitarApiKey) as T
  if (cuerpo !== null && typeof cuerpo === 'object') {
    return Object.fromEntries(
      Object.entries(cuerpo as Record<string, unknown>)
        .filter(([clave]) => clave !== 'api_key')
        .map(([clave, valor]) => [clave, quitarApiKey(valor)]),
    ) as T
  }
  return cuerpo
}
