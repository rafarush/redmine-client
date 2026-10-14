import type { H3Event } from 'h3'
import { hostPermitidoEn, quitarApiKey } from '../../shared/redmine/guards'

/**
 * Apoyo del proxy y de los endpoints de sesión (F1-T02).
 * Las comprobaciones puras viven en shared/redmine/guards.ts, con sus tests.
 */

export interface RedmineSession {
  /** Origen normalizado, sin barra final: `https://redmine.empresa.local`. */
  url: string
  apiKey: string
}

export { normalizarUrl, quitarApiKey, rutaEstaPermitida } from '../../shared/redmine/guards'

export function hostEstaPermitido(event: H3Event, url: string): boolean {
  return hostPermitidoEn(useRuntimeConfig(event).redmineAllowedHosts.split(','), url)
}

/** Comprueba la clave contra Redmine y devuelve el usuario, o lanza un error legible. */
export async function verificarCredenciales(url: string, apiKey: string): Promise<Record<string, unknown>> {
  let respuesta: Response
  try {
    respuesta = await fetch(`${url}/users/current.json`, {
      headers: { 'X-Redmine-API-Key': apiKey, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
  }
  catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'No se pudo conectar con esa URL. Comprueba que sea accesible desde este servidor.',
    })
  }

  if (respuesta.status === 401 || respuesta.status === 403) {
    throw createError({ statusCode: 401, statusMessage: 'La clave de API no es válida para esa URL.' })
  }

  const tipo = respuesta.headers.get('content-type') ?? ''
  if (!respuesta.ok || !tipo.includes('json')) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Esa dirección respondió, pero no como la API de Redmine. '
        + 'Comprueba que el servicio web REST esté activado en Administración → Ajustes → API.',
    })
  }

  const { user } = await respuesta.json() as { user?: Record<string, unknown> }
  if (!user) {
    throw createError({ statusCode: 502, statusMessage: 'La respuesta de Redmine no incluye el usuario.' })
  }
  return quitarApiKey(user)
}
