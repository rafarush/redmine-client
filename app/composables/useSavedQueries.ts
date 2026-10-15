import { useQuery } from '@tanstack/vue-query'

/**
 * Consultas guardadas de Redmine (F2-T06). Cambian poco, así que se cachean un rato;
 * si la petición falla la sidebar simplemente no las muestra.
 */
export function useSavedQueries() {
  const redmine = useRedmine()
  const query = useQuery({
    queryKey: ['saved-queries'],
    queryFn: () => redmine.listQueries(),
    staleTime: 5 * 60_000,
  })
  return { queries: computed(() => query.data.value ?? []) }
}
