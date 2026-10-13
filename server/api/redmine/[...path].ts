// Proxy BFF hacia Redmine (tarea F1-T02).
// Lee { url, apiKey } de la sesión sellada, valida el host contra runtimeConfig.redmineAllowedHosts,
// reenvía método, query y body con la cabecera X-Redmine-API-Key y devuelve la respuesta tal cual.
export default defineEventHandler(() => {
  throw createError({ statusCode: 501, statusMessage: 'Proxy de Redmine pendiente (F1-T02)' })
})
