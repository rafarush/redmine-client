/** Quita la clave de la API de Anthropic de la sesión, sin tocar la de Redmine (F12). */
export default defineEventHandler(async (event) => {
  if (getHeader(event, 'x-requested-with') !== 'redmine-client') {
    throw createError({ statusCode: 403, statusMessage: 'Petición no reconocida.' })
  }
  const session = await getUserSession(event)
  if (!session.user) throw createError({ statusCode: 401, statusMessage: 'No hay sesión. Vuelve a conectarte.' })
  const { anthropicKey: _removed, ...rest } = (session.secure ?? {}) as Record<string, unknown>
  await replaceUserSession(event, { ...session, secure: rest })
  const found = await anthropicKey(event)
  return { hasKey: found !== null, source: found?.source ?? null }
})
