import type { Issue } from './types'
import { parseDuration } from '../time/duration'

/**
 * Edición campo a campo del detalle (F3-T02): qué se puede editar, cómo se valida
 * lo escrito y qué se envía a Redmine. Cada campo se guarda solo.
 */

export type EditableField
  = | 'status_id'
    | 'assigned_to_id'
    | 'priority_id'
    | 'fixed_version_id'
    | 'category_id'
    | 'start_date'
    | 'due_date'
    | 'estimated_hours'
    | 'done_ratio'
    | `cf_${number}`

export const FIELD_LABELS: Record<Exclude<EditableField, `cf_${number}`>, string> = {
  status_id: 'Estado',
  assigned_to_id: 'Asignada a',
  priority_id: 'Prioridad',
  fixed_version_id: 'Sprint',
  category_id: 'Categoría',
  start_date: 'Empieza',
  due_date: 'Vence',
  estimated_hours: 'Estimado',
  done_ratio: 'Hecho',
}

export type FieldResult = { ok: true, payload: Record<string, unknown> } | { ok: false, error: string }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Valor escrito o elegido (siempre texto, `''` = vaciar) → cuerpo de `PUT /issues/:id`.
 * Las fechas se comprueban contra la otra fecha de la tarea.
 */
export function toFieldPayload(field: EditableField, raw: string, issue: Pick<Issue, 'start_date' | 'due_date'>): FieldResult {
  const value = raw.trim()

  if (field.startsWith('cf_')) {
    return { ok: true, payload: { custom_fields: [{ id: Number(field.slice(3)), value }] } }
  }

  switch (field) {
    case 'start_date':
    case 'due_date': {
      if (value && !ISO_DATE.test(value)) return { ok: false, error: 'Fecha no válida' }
      const start = field === 'start_date' ? value : issue.start_date ?? ''
      const due = field === 'due_date' ? value : issue.due_date ?? ''
      if (start && due && due < start) return { ok: false, error: field === 'due_date' ? 'No puede vencer antes de empezar' : 'No puede empezar después de vencer' }
      return { ok: true, payload: { [field]: value || null } }
    }
    case 'estimated_hours': {
      if (!value) return { ok: true, payload: { estimated_hours: null } }
      // En una estimación un número suelto son horas ("40" = 40 h, no 40 min) y puede
      // pasar de 24; el resto ("1h30", "1:30") se lee como una duración.
      const plain = /^\d+(?:[.,]\d+)?$/.test(value) ? Number(value.replace(',', '.')) : null
      const result = plain !== null ? (plain > 0 ? plain : null) : parseDuration(value)
      return result === null ? { ok: false, error: 'No se entiende (ej.: 4h, 1:30, 2,5)' } : { ok: true, payload: { estimated_hours: result } }
    }
    case 'done_ratio': {
      const n = Number(value)
      return Number.isInteger(n) && n >= 0 && n <= 100 ? { ok: true, payload: { done_ratio: n } } : { ok: false, error: 'Entre 0 y 100' }
    }
    default:
      // Ids de listas: vacío quita el valor (sin asignar, sin sprint, sin categoría).
      return { ok: true, payload: { [field]: value === '' ? '' : Number(value) } }
  }
}

/** Valor actual de un campo como texto, el mismo formato que espera `toFieldPayload`. */
export function currentFieldValue(field: EditableField, issue: Issue): string {
  if (field.startsWith('cf_')) {
    const value = issue.custom_fields?.find(f => f.id === Number(field.slice(3)))?.value
    return Array.isArray(value) ? value.join(', ') : value ?? ''
  }
  switch (field) {
    case 'status_id': return String(issue.status.id)
    case 'priority_id': return String(issue.priority.id)
    case 'assigned_to_id': return issue.assigned_to ? String(issue.assigned_to.id) : ''
    case 'fixed_version_id': return issue.fixed_version ? String(issue.fixed_version.id) : ''
    case 'category_id': return issue.category ? String(issue.category.id) : ''
    case 'start_date': return issue.start_date ?? ''
    case 'due_date': return issue.due_date ?? ''
    case 'estimated_hours': return issue.estimated_hours ? String(issue.estimated_hours) : ''
    case 'done_ratio': return String(issue.done_ratio)
    default: return ''
  }
}

/** % hecho que ofrece Redmine: de 10 en 10. */
export const DONE_RATIOS = Array.from({ length: 11 }, (_, i) => i * 10)

/** Puede editar la tarea: `edit_issues`, o `edit_own_issues` si la creó. */
export function canEditIssue(
  issue: Pick<Issue, 'author' | 'project'>,
  userId: number | undefined,
  can: (permission: string, projectId: number) => boolean,
): boolean {
  return can('edit_issues', issue.project.id) || (issue.author.id === userId && can('edit_own_issues', issue.project.id))
}
