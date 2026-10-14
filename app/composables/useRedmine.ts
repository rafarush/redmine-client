import type { RedmineClient } from '../../shared/redmine/client'

/**
 * El cliente de Redmine de esta sesión (F1-T03).
 *
 * Lo provee `app/plugins/redmine.client.ts`, que es quien decide el transport
 * según dónde corre la app. Nadie más tiene por qué saberlo.
 */
export function useRedmine(): RedmineClient {
  return useNuxtApp().$redmine as RedmineClient
}
