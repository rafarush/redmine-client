import { aiRequestSchema } from '../../../shared/ai/contract'

/**
 * IA para escribir con el motor "API" (F12, ADR-010): mejorar, continuar o
 * proponer campos. El prompt se construye aquí; el navegador solo manda la tarea.
 */
export default defineEventHandler(async (event) => {
  if (getHeader(event, 'x-requested-with') !== 'redmine-client') {
    throw createError({ statusCode: 403, statusMessage: 'Petición no reconocida.' })
  }
  const session = await getUserSession(event)
  if (!session.user) throw createError({ statusCode: 401, statusMessage: 'No hay sesión. Vuelve a conectarte.' })

  const parsed = aiRequestSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Petición de IA no válida.' })

  const found = await anthropicKey(event)
  if (!found) throw createError({ statusCode: 412, statusMessage: 'Falta la clave de la API de Anthropic. Añádela en Ajustes › Inteligencia artificial.' })

  // Si la persona cierra el popover, la petición a la API también se corta.
  const controller = new AbortController()
  // (El `close` de la petición salta al leer el cuerpo; el de la respuesta, si el cliente se va.)
  event.node.res.on('close', () => {
    if (!event.node.res.writableEnded) controller.abort()
  })

  try {
    return await runAnthropic(found.key, parsed.data, controller.signal)
  }
  catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    const { status, message } = explainAnthropicError(error)
    throw createError({ statusCode: status, statusMessage: message })
  }
})
