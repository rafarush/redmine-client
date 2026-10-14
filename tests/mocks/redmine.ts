import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { stripApiKey } from '../../shared/redmine/guards'

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
export const VALID_API_KEY = 'a'.repeat(40)

export const REDMINE_BASE = 'https://redmine.ejemplo.local'
export const PROXY_BASE = 'http://localhost:3000'

function readIndex(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(`${FIXTURES}index.json`, 'utf8')) as Record<string, string>
  }
  catch {
    return {}
  }
}

/** `/issues.json?status_id=open&limit=25` → clave normalizada, sin importar el orden. */
function keyFor(url: URL, prefix = ''): string {
  const path = prefix ? url.pathname.replace(prefix, '') : url.pathname
  const params = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b))
  const query = params.map(([k, v]) => `${k}=${v}`).join('&')
  return query ? `${path}?${query}` : path
}

const byKey = new Map(
  Object.entries(readIndex()).map(([path, file]) => [keyFor(new URL(path, REDMINE_BASE)), file]),
)

function respond(path: string, { hideApiKey = false } = {}): Response {
  const file = byKey.get(path)
  if (!file) {
    const message
      = `El mock no tiene fixture para ${path}. `
        + `Añade la ruta a scripts/capture-fixtures.ts y ejecuta pnpm capture:fixtures.`
    console.error(`\n${message}\nDisponibles:\n  ${[...byKey.keys()].join('\n  ')}\n`)
    return HttpResponse.json({ errors: [message] }, { status: 501 })
  }

  const body = JSON.parse(readFileSync(`${FIXTURES}${file}`, 'utf8'))
  return HttpResponse.json(hideApiKey ? stripApiKey(body) : body)
}

/** Redmine rechaza una tarea sin asunto con 422 y la lista de errores. */
function validateNewIssue(body: unknown): Response | null {
  const issue = (body as { issue?: Record<string, unknown> })?.issue
  if (issue?.subject) return null
  return HttpResponse.json(
    { errors: ['El asunto no puede estar en blanco', 'Tarea no puede estar en blanco'] },
    { status: 422 },
  )
}

export const redmineServer = setupServer(
  // --- Forma directa (Tauri)
  http.post(`${REDMINE_BASE}/issues.json`, async ({ request }) => {
    if (request.headers.get('X-Redmine-API-Key') !== VALID_API_KEY) return new HttpResponse(null, { status: 401 })
    return validateNewIssue(await request.json()) ?? HttpResponse.json({ issue: { id: 999 } }, { status: 201 })
  }),

  http.all(`${REDMINE_BASE}/*`, ({ request }) => {
    if (request.headers.get('X-Redmine-API-Key') !== VALID_API_KEY) return new HttpResponse(null, { status: 401 })
    return respond(keyFor(new URL(request.url)))
  }),

  // --- Forma por proxy (web)
  http.post(`${PROXY_BASE}/api/redmine/issues.json`, async ({ request }) => {
    if (request.headers.get('X-Requested-With') !== 'redmine-client') {
      return HttpResponse.json({ statusMessage: 'Petición no reconocida.' }, { status: 403 })
    }
    return validateNewIssue(await request.json()) ?? HttpResponse.json({ issue: { id: 999 } }, { status: 201 })
  }),

  http.all(`${PROXY_BASE}/api/redmine/*`, ({ request }) => {
    const method = request.method.toUpperCase()
    if (method !== 'GET' && request.headers.get('X-Requested-With') !== 'redmine-client') {
      return HttpResponse.json({ statusMessage: 'Petición no reconocida.' }, { status: 403 })
    }
    return respond(keyFor(new URL(request.url), '/api/redmine'), { hideApiKey: true })
  }),
)
