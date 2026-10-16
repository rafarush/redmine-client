import type { MaybeRefOrGetter } from 'vue'
import type { Issue, Paginated } from '../../shared/redmine/types'
import type { Board } from '../../shared/workspace/model'
import { useQuery } from '@tanstack/vue-query'
import { computed, toValue } from 'vue'
import { boardQueries, mergeIssues } from '../../shared/workspace/board-query'
import { rankPriorities, sortIssues } from '../../shared/workspace/sort'

/**
 * Tareas de un board (F2c): asignadas a mí y abiertas, ordenadas por prioridad
 * y fecha fin.
 *
 * La clave empieza por `['issues']` y los datos tienen la forma `{ pages: [...] }`
 * de la lista, así `useIssueChange` pinta los cambios optimistas también aquí.
 */
export function useBoardIssues(board: MaybeRefOrGetter<Board>) {
  const redmine = useRedmine()
  const workspace = useWorkspaceStore()
  const session = useSessionStore()

  const queries = computed(() => boardQueries(toValue(board), workspace.categories))

  const query = useQuery({
    queryKey: computed(() => ['issues', 'board', queries.value]),
    queryFn: async (): Promise<{ pages: Paginated<Issue>[] }> => {
      const pages = await Promise.all(queries.value.map(q => redmine.listIssues(q)))
      const items = mergeIssues(pages.map(page => page.items))
      return { pages: [{ items, totalCount: items.length, offset: 0, limit: items.length }] }
    },
    enabled: computed(() => queries.value.length > 0),
  })

  const rank = computed(() => rankPriorities(session.catalogs.priorities))
  const issues = computed<Issue[]>(() => sortIssues(query.data.value?.pages[0]?.items ?? [], rank.value))

  return { ...query, issues, empty: computed(() => queries.value.length === 0) }
}
