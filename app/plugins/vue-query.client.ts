import { QueryCache, QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { RedmineError } from '../../shared/redmine/transport'

/**
 * Caché de lo que viene de Redmine (F1-T09). Tiempos en sdd/01-arquitectura.md › ADR-004.
 *
 * Un 401 corta la sesión y lleva a la pantalla de conexión; un 403 refresca los
 * permisos, porque significa que lo que creíamos saber ya no vale.
 */
const ONE_MINUTE = 60_000

export default defineNuxtPlugin((nuxtApp) => {
  let redirecting = false

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * ONE_MINUTE,
        refetchOnWindowFocus: true,
        retry: (attempts, error) => {
          // No reintentar lo que no va a cambiar por repetirlo.
          if (error instanceof RedmineError && error.status < 500 && error.status !== 429) return false
          return attempts < 2
        },
      },
    },
    queryCache: new QueryCache({
      onError: async (error) => {
        if (!(error instanceof RedmineError)) return

        if (error.status === 401 && !redirecting) {
          redirecting = true
          const session = useSessionStore()
          await session.closeOnInvalidKey()
          await navigateTo('/connect')
          redirecting = false
        }

        if (error.status === 403) {
          // Los permisos cambiaron en Redmine; se recargan en segundo plano.
          void useSessionStore().refreshPermissions()
        }
      },
    }),
  })

  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })

  return { provide: { queryClient } }
})
