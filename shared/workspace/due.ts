/**
 * Fecha fin en el panel (F2c): como la hora de salida de un vuelo, corta y con el
 * tono justo. Hoy y vencidas piden atención; el resto es dato.
 */
export type DueTone = 'overdue' | 'today' | 'soon' | 'later' | 'none'

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DAY = 86_400_000

/** `today` en `AAAA-MM-DD` (fecha local); `due` como la devuelve Redmine. */
export function describeDue(due: string | null | undefined, today: string): { label: string, tone: DueTone } {
  if (!due) return { label: '—', tone: 'none' }
  const days = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY)
  const [, month, day] = due.split('-').map(Number) as [number, number, number]
  const short = `${day} ${MONTHS[month - 1]}`
  if (days < 0) return { label: days === -1 ? 'Ayer' : short, tone: 'overdue' }
  if (days === 0) return { label: 'Hoy', tone: 'today' }
  if (days === 1) return { label: 'Mañana', tone: 'soon' }
  return { label: short, tone: days <= 3 ? 'soon' : 'later' }
}
