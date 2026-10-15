import type { MaybeRefOrGetter } from 'vue'
import type { FilterSentence } from '../../shared/redmine/filters'
import type { IssueSort, RedmineQueryRef } from '../../shared/redmine/issue-query'
import type { Issue } from '../../shared/redmine/types'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/vue-query'
import { computed, toValue } from 'vue'
import { EMPTY_SENTENCE } from '../../shared/redmine/filters'
import { DEFAULT_SORT, ISSUES_PAGE_SIZE, toIssuesQuery } from '../../shared/redmine/issue-query'

/**
 * Lista de tareas (F2-T02): páginas de 100 por `offset`, que la lista virtualizada
 * va pidiendo con `fetchNextPage` según se acerca al final.
 *
 * Al cambiar filtros u orden se conserva la lista anterior (`isPlaceholderData`)
 * para atenuarla en vez de vaciarla mientras llega la nueva.
 */
export interface UseIssuesOptions {
  sentence?: MaybeRefOrGetter<FilterSentence>
  sort?: MaybeRefOrGetter<IssueSort | null>
  /** Consulta guardada de Redmine; si hay, manda sobre la frase. */
  savedQuery?: MaybeRefOrGetter<RedmineQueryRef | null | undefined>
}

export function useIssues(options: UseIssuesOptions = {}) {
  const redmine = useRedmine()
  const sentence = computed(() => toValue(options.sentence) ?? EMPTY_SENTENCE)
  const sort = computed(() => toValue(options.sort) ?? DEFAULT_SORT)
  const savedQuery = computed(() => toValue(options.savedQuery) ?? null)

  const query = useInfiniteQuery({
    // Sin `page` en la clave: las páginas son parte de una sola entrada.
    queryKey: computed(() => ['issues', toIssuesQuery({ sentence: sentence.value, savedQuery: savedQuery.value, sort: sort.value })]),
    queryFn: ({ pageParam }) =>
      redmine.listIssues(toIssuesQuery({ sentence: sentence.value, savedQuery: savedQuery.value, sort: sort.value, page: pageParam, now: new Date() })),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.offset + last.items.length < last.totalCount ? pages.length : undefined,
    placeholderData: keepPreviousData,
  })

  const issues = computed<Issue[]>(() => query.data.value?.pages.flatMap(p => p.items) ?? [])
  const totalCount = computed(() => query.data.value?.pages[0]?.totalCount ?? 0)

  return {
    ...query,
    issues,
    totalCount,
    pageSize: ISSUES_PAGE_SIZE,
    /** Mostrando la lista anterior mientras llega la nueva. */
    isStale: query.isPlaceholderData,
  }
}
