/**
 * Columnas de la lista de tareas (F2-T03). Lógica pura: qué columnas existen,
 * cuáles se ven por defecto y cómo se alterna una sin romper la lista.
 */
export const ISSUE_COLUMN_IDS = ['id', 'subject', 'status', 'priority', 'assigned_to', 'updated_on', 'spent_hours', 'actions'] as const
export type IssueColumnId = typeof ISSUE_COLUMN_IDS[number]

/** Sin estas dos la fila no se entiende ni se puede abrir: no se pueden ocultar. */
export const REQUIRED_COLUMNS: readonly IssueColumnId[] = ['id', 'subject']

export const DEFAULT_VISIBLE_COLUMNS: readonly IssueColumnId[] = [...ISSUE_COLUMN_IDS]

export const ISSUE_COLUMN_LABELS: Record<IssueColumnId, string> = {
  id: '#',
  subject: 'Asunto',
  status: 'Estado',
  priority: 'Prioridad',
  assigned_to: 'Asignado',
  updated_on: 'Actualizada',
  spent_hours: 'Horas',
  actions: 'Acciones',
}

/** Columna cuyo orden se pide a Redmine (`sort=`); las demás no se ordenan. */
export const SORT_FIELD: Partial<Record<IssueColumnId, string>> = {
  id: 'id',
  subject: 'subject',
  status: 'status',
  priority: 'priority',
  assigned_to: 'assigned_to',
  updated_on: 'updated_on',
  spent_hours: 'spent_hours',
}

export function toggleColumn(visible: readonly IssueColumnId[], id: IssueColumnId): IssueColumnId[] {
  if (REQUIRED_COLUMNS.includes(id)) return [...visible]
  const next = visible.includes(id) ? visible.filter(c => c !== id) : [...visible, id]
  // Siempre en el orden canónico, no en el de activación.
  return ISSUE_COLUMN_IDS.filter(c => next.includes(c))
}

/** Lee lo guardado descartando ids desconocidos; si no queda nada usable, los de fábrica. */
export function sanitizeColumns(raw: unknown): IssueColumnId[] {
  if (!Array.isArray(raw)) return [...DEFAULT_VISIBLE_COLUMNS]
  const known = ISSUE_COLUMN_IDS.filter(c => raw.includes(c) || REQUIRED_COLUMNS.includes(c))
  return known.length ? known : [...DEFAULT_VISIBLE_COLUMNS]
}
