import type { RedmineClient } from '../../shared/redmine/client'

/**
 * Sin sesión no se entra a ninguna pantalla salvo la de conexión (F1-T06).
 * Si hay cookie válida, carga perfil, catálogos y permisos antes de seguir.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const session = useSessionStore()

  if (session.connected) {
    return to.path === '/connect' ? navigateTo('/') : undefined
  }

  let hasCookie: boolean
  try {
    const { url } = await $fetch<{ url: string }>('/api/session/me')
    session.url = url
    hasCookie = true
  }
  catch {
    hasCookie = false
  }

  if (!hasCookie) {
    return to.path === '/connect' ? undefined : navigateTo('/connect')
  }

  try {
    await session.load(useNuxtApp().$redmine as RedmineClient)
  }
  catch {
    // La cookie existe pero Redmine ya no la acepta, o no responde.
    await session.closeOnInvalidKey()
    return to.path === '/connect' ? undefined : navigateTo('/connect')
  }

  if (to.path === '/connect') return navigateTo('/')
})
