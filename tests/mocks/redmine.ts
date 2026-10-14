import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { quitarApiKey } from '../../shared/redmine/guards'

/**
 * Redmine de mentira para los tests, servido desde tests/fixtures (F0-T07).
 *
 * Atiende dos formas de URL:
 *  - directa  (`https://redmine.ejemplo.local/...`), como habla Tauri;
 *  - por proxy (`/api/redmine/...`), como habla la web. Esta imita al proxy real:
 *    exige la cabecera anti-CSRF al escribir y quita la clave de API.
 */
const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url))

/** Clave válida en el mock; cualquier otra devuelve 401, como Redmine. */
export const API_KEY_VALIDA = 'a'.repeat(40)

export const BASE_REDMINE = 'https://redmine.ejemplo.local'
export const BASE_PROXY = 'http://localhost:3000'

function leerIndice(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(`${FIXTURES}index.json`, 'utf8')) as Record<string, string>
  }
  catch {
    return {}
  }
}

/** `/issues.json?status_id=open&limit=25` → clave normalizada, sin importar el orden. */
function clave(url: URL, prefijo = ''): string {
  const ruta = prefijo ? url.pathname.replace(prefijo, '') : url.pathname
  const params = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b))
  const query = params.map(([k, v]) => `${k}=${v}`).join('&')
  return query ? `${ruta}?${query}` : ruta
}

const porClave = new Map(
  Object.entries(leerIndice()).map(([ruta, archivo]) => [clave(new URL(ruta, BASE_REDMINE)), archivo]),
)

function responder(ruta: string, { ocultarApiKey = false } = {}): Response {
  const archivo = porClave.get(ruta)
  if (!archivo) {
    const mensaje
      = `El mock no tiene fixture para ${ruta}. `
        + `Añade la ruta a scripts/capture-fixtures.ts y ejecuta pnpm capture:fixtures.`
    console.error(`\n${mensaje}\nDisponibles:\n  ${[...porClave.keys()].join('\n  ')}\n`)
    return HttpResponse.json({ errors: [mensaje] }, { status: 501 })
  }

  const cuerpo = JSON.parse(readFileSync(`${FIXTURES}${archivo}`, 'utf8'))
  return HttpResponse.json(ocultarApiKey ? quitarApiKey(cuerpo) : cuerpo)
}

/** Redmine rechaza una tarea sin asunto con 422 y la lista de errores. */
function validarTareaNueva(body: unknown): Response | null {
  const issue = (body as { issue?: Record<string, unknown> })?.issue
  if (issue?.subject) return null
  return HttpResponse.json(
    { errors: ['El asunto no puede estar en blanco', 'Tarea no puede estar en blanco'] },
    { status: 422 },
  )
}

export const servidorRedmine = setupServer(
  // --- Forma directa (Tauri)
  http.post(`${BASE_REDMINE}/issues.json`, async ({ request }) => {
    if (request.headers.get('X-Redmine-API-Key') !== API_KEY_VALIDA) return new HttpResponse(null, { status: 401 })
    return validarTareaNueva(await request.json()) ?? HttpResponse.json({ issue: { id: 999 } }, { status: 201 })
  }),

  http.all(`${BASE_REDMINE}/*`, ({ request }) => {
    if (request.headers.get('X-Redmine-API-Key') !== API_KEY_VALIDA) return new HttpResponse(null, { status: 401 })
    return responder(clave(new URL(request.url)))
  }),

  // --- Forma por proxy (web)
  http.post(`${BASE_PROXY}/api/redmine/issues.json`, async ({ request }) => {
    if (request.headers.get('X-Requested-With') !== 'redmine-client') {
      return HttpResponse.json({ statusMessage: 'Petición no reconocida.' }, { status: 403 })
    }
    return validarTareaNueva(await request.json()) ?? HttpResponse.json({ issue: { id: 999 } }, { status: 201 })
  }),

  http.all(`${BASE_PROXY}/api/redmine/*`, ({ request }) => {
    const metodo = request.method.toUpperCase()
    if (metodo !== 'GET' && request.headers.get('X-Requested-With') !== 'redmine-client') {
      return HttpResponse.json({ statusMessage: 'Petición no reconocida.' }, { status: 403 })
    }
    return responder(clave(new URL(request.url), '/api/redmine'), { ocultarApiKey: true })
  }),
)
