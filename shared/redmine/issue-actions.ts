import type { Enumeration, Issue, IssueStatus, Ref } from './types'
import { RedmineError } from './transport'

/**
 * Cambios rápidos desde la fila (F2-T08): qué estados y valores se ofrecen, qué se
 * envía a Redmine y cómo se explica un rechazo. Sin Vue, para probarlo suelto.
 */

/** Lo que se puede cambiar desde el menú de la fila. */
export interface IssueChange {
  status_id?: number
  priority_id?: number
  assigned_to_id?: number | null
}

/**
 * Estados a los que se puede pasar desde esta tarea. El workflow de Redmine
 * decide cuáles, según el rol; el estado actual no se ofrece porque no es un cambio.
 */
export function statusOptions(issue: Pick<Issue, 'status'>, allowed: readonly IssueStatus[] | undefined): IssueStatus[] {
  return (allowed ?? []).filter(status => status.id !== issue.status.id)
}

/** La tarea ya tiene ese valor: no hace falta llamar a Redmine. */
export function isNoop(issue: Pick<Issue, 'status' | 'priority' | 'assigned_to'>, change: IssueChange): boolean {
  if (change.status_id !== undefined && change.status_id === issue.status.id) return true
  if (change.priority_id !== undefined && change.priority_id === issue.priority.id) return true
  if (change.assigned_to_id !== undefined && change.assigned_to_id === (issue.assigned_to?.id ?? null)) return true
  return false
}

/** El valor que tendría la tarea después del cambio, para pintarlo al instante. */
export function applyChange(
  issue: Issue,
  change: IssueChange,
  catalogs: { statuses: readonly IssueStatus[], priorities: readonly Enumeration[], members: readonly Ref[] },
): Issue {
  const next: Issue = { ...issue }
  if (change.status_id !== undefined) {
    const status = catalogs.statuses.find(s => s.id === change.status_id)
    if (status) next.status = { id: status.id, name: status.name }
  }
  if (change.priority_id !== undefined) {
    const priority = catalogs.priorities.find(p => p.id === change.priority_id)
    if (priority) next.priority = { id: priority.id, name: priority.name }
  }
  if (change.assigned_to_id !== undefined) {
    const member = change.assigned_to_id === null ? undefined : catalogs.members.find(m => m.id === change.assigned_to_id)
    next.assigned_to = change.assigned_to_id === null ? undefined : member
  }
  return next
}

/** Cuerpo de `PUT /issues/:id.json`. Solo viaja lo que cambia. */
export function toRedminePayload(change: IssueChange): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (change.status_id !== undefined) body.status_id = change.status_id
  if (change.priority_id !== undefined) body.priority_id = change.priority_id
  if (change.assigned_to_id !== undefined) body.assigned_to_id = change.assigned_to_id ?? ''
  return body
}

/**
 * Texto para el toast cuando Redmine rechaza un cambio. Los 422 traen los motivos
 * en `errors`; se traducen los más comunes y el resto se muestra tal cual.
 */
export function explainRejection(error: unknown): string {
  if (error instanceof RedmineError) {
    if (error.status === 403) return 'No tienes permiso para cambiar esta tarea.'
    if (error.status === 404) return 'La tarea ya no existe o no la puedes ver.'
    if (error.status === 422 && error.errors.length > 0) {
      return error.errors.map(translateValidation).join('. ')
    }
    if (error.status === 422) return 'Redmine no aceptó el cambio.'
  }
  return 'No se pudo conectar con Redmine. Inténtalo de nuevo.'
}

const VALIDATION_MESSAGES: [RegExp, string][] = [
  [/^status|workflow|transition/i, 'el flujo de trabajo no permite ese estado'],
  [/assigned_to.*(invalid|not)/i, 'esa persona no puede ser asignada a esta tarea'],
  [/priority.*(invalid|not)/i, 'esa prioridad no es válida'],
  [/is invalid|no es válido/i, 'un valor no es válido'],
]

function translateValidation(message: string): string {
  const hit = VALIDATION_MESSAGES.find(([pattern]) => pattern.test(message))
  return hit ? hit[1].charAt(0).toUpperCase() + hit[1].slice(1) : message
}
