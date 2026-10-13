import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

/**
 * Redmine de mentira para los tests, servido desde tests/fixtures (F0-T07).
 *
 * Responde a las mismas rutas que capturó `pnpm capture:fixtures`, así que los
 * tests no necesitan Docker. Si falta una ruta, falla con un mensaje que dice
 * cuál añadir, en vez de devolver algo vacío que confunda.
 */
const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url))

/** Clave válida en el mock; cualquier otra devuelve 401, como Redmine. */
export const API_KEY_VALIDA = 'a'.repeat(40)

export const BASE_REDMINE = 'https://redmine.ejemplo.local'

function leerIndice(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(`${FIXTURES}index.json`, 'utf8')) as Record<string, string>
  }
  catch {
    return {}
  }
}

/** `/issues.json?status_id=open&limit=25` → clave normalizada, sin importar el orden. */
function clave(url: URL): string {
  const params = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b))
  const query = params.map(([k, v]) => `${k}=${v}`).join('&')
  return query ? `${url.pathname}?${query}` : url.pathname
}

const indice = leerIndice()
const porClave = new Map(
  Object.entries(indice).map(([ruta, archivo]) => [clave(new URL(ruta, BASE_REDMINE)), archivo]),
)

export const servidorRedmine = setupServer(
  http.all(`${BASE_REDMINE}/*`, ({ request }) => {
    if (request.headers.get('X-Redmine-API-Key') !== API_KEY_VALIDA) {
      return new HttpResponse(null, { status: 401 })
    }

    const url = new URL(request.url)
    const archivo = porClave.get(clave(url))
    if (!archivo) {
      // MSW convierte una excepción en un 500 anónimo, así que el aviso va en el
      // cuerpo y también en stderr, para que se vea en la salida del test.
      const mensaje
        = `El mock no tiene fixture para ${clave(url)}. `
          + `Añade la ruta a scripts/capture-fixtures.ts y ejecuta pnpm capture:fixtures.`
      console.error(`\n${mensaje}\nDisponibles:\n  ${[...porClave.keys()].join('\n  ')}\n`)
      return HttpResponse.json({ errors: [mensaje] }, { status: 501 })
    }

    return HttpResponse.json(JSON.parse(readFileSync(`${FIXTURES}${archivo}`, 'utf8')))
  }),
)
