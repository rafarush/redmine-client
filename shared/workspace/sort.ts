/**
 * Orden de las tareas en un board (F2c): como un panel de salidas.
 * Primero la prioridad (de mayor a menor), luego la fecha fin (la más cercana
 * primero; sin fecha al final) y, a igualdad, el número de tarea.
 */
export interface SortableIssue {
  id: number
  priority: { id: number }
  due_date?: string | null
}

/**
 * `priorityRank` da la posición de cada prioridad en la enumeración de Redmine
 * (0 = la más baja). Una prioridad que no esté cuenta como la más baja.
 */
export function compareIssues(priorityRank: ReadonlyMap<number, number>) {
  return (a: SortableIssue, b: SortableIssue): number => {
    const byPriority = (priorityRank.get(b.priority.id) ?? -1) - (priorityRank.get(a.priority.id) ?? -1)
    if (byPriority !== 0) return byPriority
    const due = (a.due_date ?? '￿').localeCompare(b.due_date ?? '￿')
    if (due !== 0) return due
    return a.id - b.id
  }
}

export function sortIssues<T extends SortableIssue>(issues: readonly T[], priorityRank: ReadonlyMap<number, number>): T[] {
  return [...issues].sort(compareIssues(priorityRank))
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
