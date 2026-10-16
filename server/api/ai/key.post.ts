import { z } from 'zod'

const bodySchema = z.object({
  key: z.string().trim().regex(/^sk-ant-[\w-]{20,}$/, 'Eso no parece una clave de la API de Anthropic (empieza por sk-ant-).'),
})

/**
 * Guarda la clave de la API de Anthropic en la sesión sellada tras probarla con
 * una petición mínima (F12). No vuelve al navegador.
 */
export default defineEventHandler(async (event) => {
  if (getHeader(event, 'x-requested-with') !== 'redmine-client') {
    throw createError({ statusCode: 403, statusMessage: 'Petición no reconocida.' })
  }
  const session = await getUserSession(event)
  if (!session.user) throw createError({ statusCode: 401, statusMessage: 'No hay sesión. Vuelve a conectarte.' })

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })

  try {
    await runAnthropic(parsed.data.key, { task: 'continue', before: 'Prueba de conexión.', model: 'claude-haiku-5-5' })
  }
  catch (error) {
    const { status, message } = explainAnthropicError(error)
    throw createError({ statusCode: status, statusMessage: message })
  }

  await setUserSession(event, { secure: { anthropicKey: parsed.data.key } })
  return { hasKey: true, source: 'session' as const }
})
