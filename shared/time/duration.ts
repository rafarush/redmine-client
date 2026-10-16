/**
 * Duraciones (F2c, adelanta F4-T01): leer lo que escribe una persona, redondear
 * lo medido por el cronómetro y mostrarlo. Redmine guarda horas decimales.
 */

const MS_PER_HOUR = 3_600_000

/** Más que esto en un solo registro es un error de tecleo, no una jornada. */
export const MAX_HOURS = 24

/**
 * Lee "1,5", "1.5", "1:30", "1h 30", "1h30m", "90m", "90 min" o "2 h" y devuelve horas
 * (F4-T01). Un número suelto ≤ 12 son horas y > 12 son minutos ("45" → 45 min).
 * `null` si no se entiende, es ≤ 0 o pasa de 24 h.
 */
export function parseDuration(text: string): number | null {
  const value = text.trim().toLowerCase().replace(',', '.')
  if (!value) return null

  let hours: number | null = null
  const clock = /^(\d+):([0-5]\d)$/.exec(value)
  const units = /^(?:(\d+(?:\.\d+)?)\s*h(?:oras?)?)?\s*(?:(\d+)\s*(?:m|min|minutos?)?)?$/.exec(value)

  if (clock) hours = Number(clock[1]) + Number(clock[2]) / 60
  else if (/^\d+(?:\.\d+)?$/.test(value)) hours = Number(value) > 12 ? Number(value) / 60 : Number(value)
  else if (/^\d+\s*(?:m|min|minutos?)$/.test(value)) hours = Number.parseInt(value, 10) / 60
  else if (units && (units[1] || units[2])) hours = Number(units[1] ?? 0) + Number(units[2] ?? 0) / 60

  return hours !== null && Number.isFinite(hours) && hours > 0 && hours <= MAX_HOURS ? hours : null
}

/** Horas transcurridas entre dos instantes (ms). */
export function elapsedHours(startedAt: number, now: number): number {
  return Math.max(0, now - startedAt) / MS_PER_HOUR
}

/**
 * Redondea hacia arriba al paso indicado (5 min por defecto) y nunca baja de un paso:
 * un minuto de trabajo se registra como el mínimo, no como cero.
 */
export function roundHours(hours: number, stepMinutes = 5): number {
  const minutes = Math.max(stepMinutes, Math.ceil((hours * 60) / stepMinutes - 1e-9) * stepMinutes)
  return Math.round((minutes / 60) * 100) / 100
}

/** "1 h 45 min", "32 min", "2 h". */
export function formatDuration(hours: number): string {
  const total = Math.round(hours * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** Cronómetro "00:32:10". */
export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`
}

/** Horas para celdas y totales compactos: "1:30", "0:45", "8:00" (F4-T01). */
export function formatHours(hours: number): string {
  const total = Math.round(hours * 60)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Lo que se entendió al escribir, para enseñarlo junto al campo (F4-T01): "45" no
 * es obvio, así que se dice "= 45 min". `null` si no hay nada que decir.
 */
export function describeDuration(text: string): { hours: number | null, label: string } | null {
  if (!text.trim()) return null
  const hours = parseDuration(text)
  return { hours, label: hours === null ? 'No se entiende (ej.: 1h30, 1:30, 1,5)' : `= ${formatDuration(hours)}` }
}
