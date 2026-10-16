import type { AgentStatusMap, QueueStatus } from './model'

/**
 * Estados de Redmine según la fase de la cola (F11-T07). Solo tres fases cambian
 * el estado (empieza, PR abierta, bloqueada) y solo si la persona las mapeó.
 */
export function statusForPhase(map: AgentStatusMap, phase: QueueStatus): number | undefined {
  if (phase === 'working') return map.working
  if (phase === 'pr_opened') return map.pr_opened
  if (phase === 'blocked') return map.blocked
  return undefined
}

/**
 * ¿Se puede aplicar? Si la tarea ya está en ese estado no hace falta; si Redmine
 * da `allowed_statuses` y no lo incluye, el workflow no lo permite.
 */
export function canApplyStatus(target: number, current: number, allowed?: readonly { id: number }[]): 'apply' | 'already' | 'not_allowed' {
  if (target === current) return 'already'
  if (allowed && allowed.length > 0 && !allowed.some(s => s.id === target)) return 'not_allowed'
  return 'apply'
}
