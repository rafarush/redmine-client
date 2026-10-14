/** Usuario de la sesión y URL de su Redmine. Nunca la clave de API. */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const secure = session.secure as RedmineSession | undefined

  if (!secure?.apiKey) {
    throw createError({ statusCode: 401, statusMessage: 'No hay sesión.' })
  }

  return { user: stripApiKey(session.user), url: secure.url }
})
