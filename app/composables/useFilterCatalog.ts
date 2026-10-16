import type { MaybeRefOrGetter } from 'vue'
import type { CustomFieldDef, FilterOption } from '../../shared/redmine/filter-fields'
import type { FilterSentence } from '../../shared/redmine/filters'
import type { Issue } from '../../shared/redmine/types'
import { useQueries, useQuery } from '@tanstack/vue-query'
import { computed, toValue } from 'vue'
import { customFieldsFromAdmin, customFieldsFromIssues, mergePeople } from '../../shared/redmine/filter-fields'
import { conditionFor } from '../../shared/redmine/filters'

/**
 * Lo que la frase de filtros ofrece además de los catálogos (F2-T10):
 *
 * - Campos personalizados: de `/custom_fields.json` si eres admin (con `is_filter`
 *   y sus valores); si no, deducidos de las tareas de la lista.
 * - Personas: miembros de los proyectos de la frase (o de los tuyos, si la frase no
 *   tiene proyecto), más las que salen en la lista.
 */
export function useFilterCatalog(sentence: MaybeRefOrGetter<FilterSentence>, issues: MaybeRefOrGetter<Issue[]>) {
  const redmine = useRedmine()
  const session = useSessionStore()

  const admin = computed(() => !!session.user?.admin)
  const adminFields = useQuery({
    queryKey: ['custom-fields'],
    queryFn: async () => customFieldsFromAdmin(await redmine.listCustomFields()),
    enabled: admin,
    staleTime: 30 * 60_000,
    retry: false,
  })

  const customFields = computed<CustomFieldDef[]>(() => admin.value && adminFields.data.value
    ? adminFields.data.value
    : customFieldsFromIssues(toValue(issues)))

  /** Proyectos de los que sacar miembros: los de la frase, o aquellos de los que eres miembro. */
  const projectIds = computed(() => {
    const chosen = conditionFor(toValue(sentence), 'project_id')?.values.map(Number).filter(Number.isInteger) ?? []
    const mine = session.user?.memberships.map(m => m.project.id) ?? []
    return [...new Set(chosen.length > 0 ? chosen : mine)].sort((a, b) => a - b).slice(0, 20)
  })

  const members = useQueries({
    queries: computed(() => projectIds.value.map(id => ({
      queryKey: ['members', id],
      queryFn: () => redmine.listProjectMembers(id),
      staleTime: 10 * 60_000,
    }))),
  })

  const people = computed<FilterOption[]>(() => {
    const fromMembers = members.value.flatMap(q => q.data ?? []).map(u => ({ value: String(u.id), label: u.name }))
    const fromList: FilterOption[] = []
    for (const issue of toValue(issues)) {
      if (issue.assigned_to) fromList.push({ value: String(issue.assigned_to.id), label: issue.assigned_to.name })
      fromList.push({ value: String(issue.author.id), label: issue.author.name })
    }
    return mergePeople(fromMembers, fromList)
  })

  return { customFields, people }
}
