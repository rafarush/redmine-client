import type { MaybeRefOrGetter } from 'vue'
import type { Version } from '../../shared/redmine/types'
import { useQuery } from '@tanstack/vue-query'
import { computed, toValue } from 'vue'

/**
 * Versiones (sprints) de varios proyectos para el kanban (F2d). Una versión
 * compartida sale en varios proyectos: se queda una vez.
 */
export function useBoardVersions(projectIds: MaybeRefOrGetter<number[]>) {
  const redmine = useRedmine()
  const ids = computed(() => [...new Set(toValue(projectIds))].sort((a, b) => a - b))

  const query = useQuery({
    queryKey: computed(() => ['versions', ids.value]),
    queryFn: async () => {
      const lists = await Promise.all(ids.value.map(id => redmine.listVersions(id)))
      const seen = new Set<number>()
      return lists.flat().filter((version) => {
        if (seen.has(version.id)) return false
        seen.add(version.id)
        return true
      })
    },
    enabled: computed(() => ids.value.length > 0),
    staleTime: 5 * 60_000,
  })

  return { ...query, versions: computed<Version[]>(() => query.data.value ?? []) }
}
