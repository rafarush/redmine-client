import type { MaybeRefOrGetter } from 'vue'
import type { FilterOption } from '../../shared/redmine/filter-fields'
import type { FilterField } from '../../shared/redmine/filters'
import { toValue } from 'vue'

const STATUS_SHORTCUTS: FilterOption[] = [
  { value: 'open', label: 'Cualquier estado abierto' },
  { value: 'closed', label: 'Cualquier estado cerrado' },
  { value: '*', label: 'Cualquier estado' },
]

/**
 * Valores que ofrece cada campo de la frase (F2-T04), según los catálogos de la
 * sesión: solo proyectos visibles, solo estados y tipos que existen.
 * Devuelve una función `campo → opciones`.
 */
export function useFilterOptions(people: MaybeRefOrGetter<FilterOption[]>) {
  const session = useSessionStore()
  const toOptions = (items: { id: number, name: string }[]): FilterOption[] =>
    items.map(item => ({ value: String(item.id), label: item.name }))

  return (field: FilterField): FilterOption[] => {
    const { statuses, trackers, priorities, projects } = session.catalogs

    switch (field) {
      case 'status_id':
        return [...STATUS_SHORTCUTS, ...toOptions(statuses)]
      case 'tracker_id':
        return toOptions(trackers)
      case 'priority_id':
        return toOptions(priorities)
      case 'project_id':
        return toOptions(projects)
      case 'assigned_to_id':
      case 'author_id':
        return [{ value: 'me', label: 'Yo' }, ...toValue(people)]
      default:
        return []
    }
  }
}
