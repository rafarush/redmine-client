import { z } from 'zod'

const cuerpoSchema = z.object({
  url: z.string().min(1, 'Escribe la URL de tu Redmine.'),
  apiKey: z.string().regex(/^[0-9a-f]{40}$/i, 'La clave de API son 40 caracteres hexadecimales.'),
})

/**
 * Guarda `{ url, apiKey }` en la cookie sellada tras comprobarlos contra Redmine (F1-T02).
 * La clave no vuelve al navegador en ningún momento.
 */
export default defineEventHandler(async (event) => {
  const parseado = cuerpoSchema.safeParse(await readBody(event))
  if (!parseado.success) {
    throw createError({ statusCode: 400, statusMessage: parseado.error.issues[0]!.message })
  }

  let url: string
  try {
    url = normalizarUrl(parseado.data.url)
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'Esa URL no es válida.' })
  }

  if (!hostEstaPermitido(event, url)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Este servidor no tiene permitido conectarse a ese host. '
        + 'Pide que lo añadan a NUXT_REDMINE_ALLOWED_HOSTS.',
    })
  }

  const user = await verificarCredenciales(url, parseado.data.apiKey)

  await setUserSession(event, {
    user,
    secure: { url, apiKey: parseado.data.apiKey } satisfies RedmineSession,
  })

  return { user, url }
})
