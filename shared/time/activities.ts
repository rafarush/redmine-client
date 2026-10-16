import type { TimeEntry } from '../redmine/types'

/**
 * Chips de actividad del popover de tiempo (F4-T03): las más usadas por la persona
 * en ese proyecto, y la última usada preseleccionada. Sin historial, las primeras
 * del catálogo (empezando por la marcada por defecto).
 */
export function topActivities<A extends { id: number, name: string, is_default?: boolean }>(
  entries: readonly Pick<TimeEntry, 'project' | 'activity' | 'spent_on' | 'created_on'>[],
  projectId: number,
  catalog: readonly A[],
  count = 3,
): { top: A[], preferred: number | undefined } {
  const mine = entries.filter(e => e.project.id === projectId)
  const uses = new Map<number, number>()
  for (const entry of mine) uses.set(entry.activity.id, (uses.get(entry.activity.id) ?? 0) + 1)

  const known = catalog.filter(a => uses.has(a.id)).sort((a, b) => uses.get(b.id)! - uses.get(a.id)! || a.name.localeCompare(b.name, 'es'))
  const rest = catalog.filter(a => !uses.has(a.id)).sort((a, b) => Number(!!b.is_default) - Number(!!a.is_default))
  const top = [...known, ...rest].slice(0, count)

  const last = [...mine].sort((a, b) => b.spent_on.localeCompare(a.spent_on) || b.created_on.localeCompare(a.created_on))[0]
  const preferred = last && catalog.some(a => a.id === last.activity.id)
    ? last.activity.id
    : (catalog.find(a => a.is_default) ?? catalog[0])?.id
  return { top, preferred }
}
