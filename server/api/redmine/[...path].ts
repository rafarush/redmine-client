/**
 * Proxy hacia Redmine (F1-T02). Ver sdd/01-arquitectura.md › ADR-002.
 *
 * Reenvía la petición con la clave de la sesión. Comprueba tres cosas antes:
 * que haya sesión, que el host esté en la lista permitida (SSRF) y que la ruta
 * sea de la API de Redmine. Nunca registra la clave ni el cuerpo.
 */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const secure = session.secure as RedmineSession | undefined

  if (!secure?.apiKey) {
    throw createError({ statusCode: 401, statusMessage: 'No hay sesión. Vuelve a conectarte.' })
  }

  const method = event.method.toUpperCase()

  /*
   * Defensa CSRF: la cookie es SameSite=Lax, que ya frena los envíos entre sitios,
   * y además exigimos una cabecera que un formulario HTML no puede poner.
   */
  if (WRITE_METHODS.has(method) && getHeader(event, 'x-requested-with') !== 'redmine-client') {
    throw createError({ statusCode: 403, statusMessage: 'Petición no reconocida.' })
  }

  const path = `/${(getRouterParam(event, 'path') ?? '').replace(/^\/+/, '')}`
  if (!isPathAllowed(path)) {
    throw createError({ statusCode: 404, statusMessage: 'Esa ruta no es de la API de Redmine.' })
  }

  if (!isHostAllowed(event, secure.url)) {
    throw createError({ statusCode: 403, statusMessage: 'Host no permitido por este servidor.' })
  }

  const target = new URL(`${secure.url}${path}`)
  for (const [key, value] of Object.entries(getQuery(event))) {
    if (value !== undefined) target.searchParams.set(key, String(value))
  }

  const contentType = getHeader(event, 'content-type')
  const body = WRITE_METHODS.has(method) && method !== 'DELETE'
    // Binario para /uploads.json, JSON para el resto.
    ? (contentType?.includes('octet-stream')
        ? await readRawBody(event, false)
        : await readRawBody(event, 'utf8'))
    : undefined

  let response: Response
  try {
    response = await fetch(target, {
      method,
      headers: {
        'X-Redmine-API-Key': secure.apiKey,
        'Accept': 'application/json',
        ...(body !== undefined && contentType ? { 'Content-Type': contentType } : {}),
      },
      body: body as BodyInit | undefined,
      signal: AbortSignal.timeout(30_000),
    })
  }
  catch {
    // Sin detalles del error: podrían filtrar la topología de la red interna.
    throw createError({ statusCode: 502, statusMessage: 'No se pudo contactar con Redmine.' })
  }

  setResponseStatus(event, response.status)

  const responseContentType = response.headers.get('content-type') ?? ''

  // Descargas de adjuntos: se devuelven tal cual.
  if (!responseContentType.includes('json')) {
    setResponseHeader(event, 'content-type', responseContentType || 'application/octet-stream')
    const disposition = response.headers.get('content-disposition')
    if (disposition) setResponseHeader(event, 'content-disposition', disposition)
    return response.body
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') return null

  const text = await response.text()
  if (!text) return null

  // La clave de API nunca sale hacia el navegador, venga donde venga.
  return stripApiKey(JSON.parse(text))
})
