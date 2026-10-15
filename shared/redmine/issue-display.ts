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

/** Palabras que no cuentan para el código de proyecto. */
const CODE_STOPWORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'para', 'the', 'of', 'and'])

/**
 * Código de 3 letras de un proyecto, como el de un vuelo (F2b, Panel de embarque):
 * una palabra → sus 3 primeras letras; dos → inicial + 2 letras de la segunda;
 * tres o más → iniciales. Sin tildes y en mayúsculas.
 */
export function projectCode(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .split(/[^a-z0-9]+/i)
    .filter(word => word && !CODE_STOPWORDS.has(word.toLowerCase()))
  if (words.length === 0) return '—'
  const [first, second, third] = words as [string, string?, string?]
  const code = third
    ? first[0]! + second![0]! + third[0]!
    : second
      ? first[0]! + second.slice(0, 2)
      : first.slice(0, 3)
  return code.toUpperCase()
}

export type PriorityLevel = 'low' | 'normal' | 'high' | 'urgent'

/**
 * Nivel de una prioridad según su posición en la enumeración de Redmine
 * (ordenada de menor a mayor) respecto a la prioridad por defecto.
 */
export function priorityLevel(position: number, defaultPosition: number): PriorityLevel {
  const delta = position - defaultPosition
  if (delta < 0) return 'low'
  if (delta === 0) return 'normal'
  return delta === 1 ? 'high' : 'urgent'
}

/** Icono Lucide de cada nivel: la prioridad nunca se comunica solo con color. */
export const PRIORITY_ICON: Record<PriorityLevel, string> = {
  low: 'lucide:chevron-down',
  normal: 'lucide:minus',
  high: 'lucide:chevron-up',
  urgent: 'lucide:chevrons-up',
}
