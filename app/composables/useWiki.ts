import type { MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { computed, toValue } from 'vue'
import { RedmineError } from '../../shared/redmine/transport'

/**
 * Wiki de un proyecto (F7): índice y página. Una página que no existe no es un
 * error para la interfaz: se devuelve `null` y la vista ofrece crearla.
 */

export function useWikiIndex(project: MaybeRefOrGetter<string | undefined>) {
  const redmine = useRedmine()
  return useQuery({
    queryKey: computed(() => ['wiki', toValue(project), 'index']),
    queryFn: () => redmine.listWikiPages(toValue(project)!),
    enabled: computed(() => !!toValue(project)),
    staleTime: 60_000,
  })
}

export function useWikiPage(project: MaybeRefOrGetter<string | undefined>, title: MaybeRefOrGetter<string>) {
  const redmine = useRedmine()
  return useQuery({
    queryKey: computed(() => ['wiki', toValue(project), 'page', toValue(title)]),
    queryFn: async () => {
      try {
        return await redmine.getWikiPage(toValue(project)!, toValue(title))
      }
      catch (error) {
        if (error instanceof RedmineError && error.status === 404) return null
        throw error
      }
    },
    enabled: computed(() => !!toValue(project) && !!toValue(title)),
    staleTime: 30_000,
  })
}
