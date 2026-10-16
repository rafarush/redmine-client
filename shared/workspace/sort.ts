/**
 * Orden de las tareas en un board (F2c): como un panel de salidas.
 * Primero el estado (en el orden de Ajustes; por defecto En curso, luego Nueva y
 * el resto), dentro de cada estado la prioridad (de mayor a menor), luego la fecha
 * fin (la más cercana primero; sin fecha al final) y, a igualdad, el número de tarea.
 */
export interface SortableIssue {
  id: number
  priority: { id: number }
  status?: { id: number }
  due_date?: string | null
}

export interface OrderableStatus { id: number, name: string }

/** Los nombres de Redmine son locales: se reconocen por nombre, como en `guessStatusMap`. */
const IN_PROGRESS = /en curso|en proceso|en progreso|in progress|doing|trabajando/i
const TODO = /^\s*nuev[ao]\s*$|\bnew\b|to ?do|por hacer|pendiente/i

/** Orden por defecto: En curso primero, luego Nueva / ToDo y después el resto (orden del catálogo). */
export function defaultStatusOrder(statuses: readonly OrderableStatus[]): number[] {
  const tier = (status: OrderableStatus) => IN_PROGRESS.test(status.name) ? 0 : TODO.test(status.name) ? 1 : 2
  return statuses
    .map((status, index) => ({ id: status.id, tier: tier(status), index }))
    .sort((a, b) => a.tier - b.tier || a.index - b.index)
    .map(item => item.id)
}

/**
 * Orden efectivo de los estados: primero los guardados que sigan existiendo y
 * después los que falten (por ejemplo uno nuevo de Redmine) en el orden por defecto.
 */
export function effectiveStatusOrder(statuses: readonly OrderableStatus[], saved: readonly number[]): number[] {
  const known = new Set(statuses.map(status => status.id))
  const order = [...new Set(saved)].filter(id => known.has(id))
  const placed = new Set(order)
  return [...order, ...defaultStatusOrder(statuses).filter(id => !placed.has(id))]
}

/** Rango de cada estado (0 = el primero). */
export function resolveStatusRank(statuses: readonly OrderableStatus[], saved: readonly number[]): Map<number, number> {
  return new Map(effectiveStatusOrder(statuses, saved).map((id, index) => [id, index]))
}

/**
 * `priorityRank` da la posición de cada prioridad en la enumeración de Redmine
 * (0 = la más baja). Una prioridad que no esté cuenta como la más baja.
 */
export function compareIssues(priorityRank: ReadonlyMap<number, number>, statusRank?: ReadonlyMap<number, number>) {
  const rankOf = (issue: SortableIssue) => statusRank?.get(issue.status?.id ?? -1) ?? Number.MAX_SAFE_INTEGER
  return (a: SortableIssue, b: SortableIssue): number => {
    if (statusRank) {
      const byStatus = rankOf(a) - rankOf(b)
      if (byStatus !== 0) return byStatus
    }
    const byPriority = (priorityRank.get(b.priority.id) ?? -1) - (priorityRank.get(a.priority.id) ?? -1)
    if (byPriority !== 0) return byPriority
    const due = (a.due_date ?? '￿').localeCompare(b.due_date ?? '￿')
    if (due !== 0) return due
    return a.id - b.id
  }
}

export function sortIssues<T extends SortableIssue>(issues: readonly T[], priorityRank: ReadonlyMap<number, number>, statusRank?: ReadonlyMap<number, number>): T[] {
  return [...issues].sort(compareIssues(priorityRank, statusRank))
}

export interface StatusGroup<T> {
  statusId: number
  name: string
  issues: T[]
}

/** Parte unas tareas ya ordenadas en grupos consecutivos por estado. */
export function groupByStatus<T extends SortableIssue & { status: { id: number, name: string } }>(issues: readonly T[]): StatusGroup<T>[] {
  const groups: StatusGroup<T>[] = []
  for (const issue of issues) {
    const last = groups[groups.length - 1]
    if (last && last.statusId === issue.status.id) last.issues.push(issue)
    else groups.push({ statusId: issue.status.id, name: issue.status.name, issues: [issue] })
  }
  return groups
}

/** Rango de cada prioridad a partir de la enumeración, que Redmine devuelve de menor a mayor. */
export function rankPriorities(priorities: ReadonlyArray<{ id: number }>): Map<number, number> {
  return new Map(priorities.map((priority, index) => [priority.id, index]))
}

/** La prioridad vecina para ▲ (`up`) o ▼ (`down`); `undefined` si ya está en el extremo. */
export function adjacentPriority<T extends { id: number }>(priorities: readonly T[], currentId: number, direction: 'up' | 'down'): T | undefined {
  const index = priorities.findIndex(priority => priority.id === currentId)
  if (index < 0) return undefined
  return priorities[direction === 'up' ? index + 1 : index - 1]
}
