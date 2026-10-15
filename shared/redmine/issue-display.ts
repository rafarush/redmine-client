/**
 * Cómo se ve una tarea en la lista (F2): lógica pura, sin Vue.
 * El estado y la prioridad llevan icono + texto; el color solo refuerza.
 */
export type IssueTone = 'info' | 'success' | 'warning' | 'neutral'

/** Prioridades que piden atención: alta, urgente, inmediata (en español o inglés). */
const ATTENTION_PRIORITY = /alta|urgente|inmediata|high|urgent|immediate/i

export function isAttentionPriority(name: string): boolean {
  return ATTENTION_PRIORITY.test(name)
}

export function statusIcon(closed: boolean): string {
  return closed ? 'lucide:circle-check' : 'lucide:circle-dot'
}

export function statusTone(closed: boolean): IssueTone {
  return closed ? 'success' : 'info'
}
