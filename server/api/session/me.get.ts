/** Usuario de la sesión y URL de su Redmine. Nunca la clave de API. */
export default defineEventHandler(async (event) => {
  const sesion = await getUserSession(event)
  const secure = sesion.secure as RedmineSession | undefined

  if (!secure?.apiKey) {
    throw createError({ statusCode: 401, statusMessage: 'No hay sesión.' })
  }

  return { user: quitarApiKey(sesion.user), url: secure.url }
})
