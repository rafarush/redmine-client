/**
 * Proxy hacia Redmine (F1-T02). Ver sdd/01-arquitectura.md › ADR-002.
 *
 * Reenvía la petición con la clave de la sesión. Comprueba tres cosas antes:
 * que haya sesión, que el host esté en la lista permitida (SSRF) y que la ruta
 * sea de la API de Redmine. Nunca registra la clave ni el cuerpo.
 */
const METODOS_QUE_ESCRIBEN = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export default defineEventHandler(async (event) => {
  const sesion = await getUserSession(event)
  const secure = sesion.secure as RedmineSession | undefined

  if (!secure?.apiKey) {
    throw createError({ statusCode: 401, statusMessage: 'No hay sesión. Vuelve a conectarte.' })
  }

  const method = event.method.toUpperCase()

  /*
   * Defensa CSRF: la cookie es SameSite=Lax, que ya frena los envíos entre sitios,
   * y además exigimos una cabecera que un formulario HTML no puede poner.
   */
  if (METODOS_QUE_ESCRIBEN.has(method) && getHeader(event, 'x-requested-with') !== 'redmine-client') {
    throw createError({ statusCode: 403, statusMessage: 'Petición no reconocida.' })
  }

  const path = `/${(getRouterParam(event, 'path') ?? '').replace(/^\/+/, '')}`
  if (!rutaEstaPermitida(path)) {
    throw createError({ statusCode: 404, statusMessage: 'Esa ruta no es de la API de Redmine.' })
  }

  if (!hostEstaPermitido(event, secure.url)) {
    throw createError({ statusCode: 403, statusMessage: 'Host no permitido por este servidor.' })
  }

  const destino = new URL(`${secure.url}${path}`)
  for (const [clave, valor] of Object.entries(getQuery(event))) {
    if (valor !== undefined) destino.searchParams.set(clave, String(valor))
  }

  const contentType = getHeader(event, 'content-type')
  const cuerpo = METODOS_QUE_ESCRIBEN.has(method) && method !== 'DELETE'
    // Binario para /uploads.json, JSON para el resto.
    ? (contentType?.includes('octet-stream')
        ? await readRawBody(event, false)
        : await readRawBody(event, 'utf8'))
    : undefined

  let respuesta: Response
  try {
    respuesta = await fetch(destino, {
      method,
      headers: {
        'X-Redmine-API-Key': secure.apiKey,
        'Accept': 'application/json',
        ...(cuerpo !== undefined && contentType ? { 'Content-Type': contentType } : {}),
      },
      body: cuerpo as BodyInit | undefined,
      signal: AbortSignal.timeout(30_000),
    })
  }
  catch {
    // Sin detalles del error: podrían filtrar la topología de la red interna.
    throw createError({ statusCode: 502, statusMessage: 'No se pudo contactar con Redmine.' })
  }

  setResponseStatus(event, respuesta.status)

  const tipoRespuesta = respuesta.headers.get('content-type') ?? ''

  // Descargas de adjuntos: se devuelven tal cual.
  if (!tipoRespuesta.includes('json')) {
    setResponseHeader(event, 'content-type', tipoRespuesta || 'application/octet-stream')
    const disposicion = respuesta.headers.get('content-disposition')
    if (disposicion) setResponseHeader(event, 'content-disposition', disposicion)
    return respuesta.body
  }

  if (respuesta.status === 204 || respuesta.headers.get('content-length') === '0') return null

  const texto = await respuesta.text()
  if (!texto) return null

  // La clave de API nunca sale hacia el navegador, venga donde venga.
  return quitarApiKey(JSON.parse(texto))
})
