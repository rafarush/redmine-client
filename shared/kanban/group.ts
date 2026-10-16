/**
 * Kanban de un board (F2d-T01): agrupar tareas por estado, por sprint (versión
 * objetivo de Redmine, `fixed_version`) o en matriz sprint × estado. Lógica pura.
 */
export type KanbanMode = 'status' | 'sprint' | 'matrix'

export const KANBAN_MODES: readonly KanbanMode[] = ['status', 'sprint', 'matrix']

export interface KanbanIssue {
  id: number
  status: { id: number }
  fixed_version?: { id: number } | null
}

export interface KanbanStatus { id: number, name: string, is_closed?: boolean }
export interface KanbanVersion { id: number, name: string, status?: string, due_date?: string | null }

export interface Lane<T> {
  /** Estado o versión; `null` es "Sin sprint". */
  id: number | null
  label: string
  issues: T[]
}

export interface MatrixRow<T> {
  id: number | null
  label: string
  cells: Lane<T>[]
}

export const NO_SPRINT = 'Sin sprint'

/** Columnas de estado: los abiertos del catálogo en su orden, más cualquier otro que tenga tareas. */
export function statusLanes<T extends KanbanIssue>(issues: readonly T[], statuses: readonly KanbanStatus[]): Lane<T>[] {
  const used = new Set(issues.map(issue => issue.status.id))
  return statuses
    .filter(status => !status.is_closed || used.has(status.id))
    .map(status => ({ id: status.id, label: status.name, issues: issues.filter(issue => issue.status.id === status.id) }))
}

/**
 * Sprints que se muestran: los abiertos o bloqueados (y los cerrados que aún
 * tengan tareas), del que vence antes al que vence después; sin fecha al final.
 */
export function sprintOrder<T extends KanbanIssue>(issues: readonly T[], versions: readonly KanbanVersion[]): KanbanVersion[] {
  const used = new Set(issues.map(issue => issue.fixed_version?.id).filter(Boolean))
  return versions
    .filter(version => version.status !== 'closed' || used.has(version.id))
    .sort((a, b) => (a.due_date ?? '￿').localeCompare(b.due_date ?? '￿') || a.name.localeCompare(b.name, 'es'))
}

export function sprintLanes<T extends KanbanIssue>(issues: readonly T[], versions: readonly KanbanVersion[]): Lane<T>[] {
  const lanes: Lane<T>[] = sprintOrder(issues, versions).map(version => ({
    id: version.id,
    label: version.name,
    issues: issues.filter(issue => issue.fixed_version?.id === version.id),
  }))
  const known = new Set(lanes.map(lane => lane.id))
  // Una versión que no está en la lista (de otro proyecto, compartida) cae en "Sin sprint".
  lanes.push({ id: null, label: NO_SPRINT, issues: issues.filter(issue => !issue.fixed_version || !known.has(issue.fixed_version.id)) })
  return lanes
}

export function matrix<T extends KanbanIssue>(issues: readonly T[], statuses: readonly KanbanStatus[], versions: readonly KanbanVersion[]): MatrixRow<T>[] {
  return sprintLanes(issues, versions).map(sprint => ({
    id: sprint.id,
    label: sprint.label,
    cells: statusLanes(sprint.issues, statuses).map(lane => ({ ...lane, issues: lane.issues })),
  }))
}

export function isKanbanMode(value: unknown): value is KanbanMode {
  return typeof value === 'string' && (KANBAN_MODES as readonly string[]).includes(value)
}
