import type { FieldSuggestion } from './contract'
import { matchByName } from '../import/model'

/**
 * Piezas puras del lado del editor (F12): reemplazar lo seleccionado, decidir
 * cuándo pedir texto fantasma y cómo limpiarlo, y convertir una propuesta de
 * campos en ids del proyecto.
 */

/** Sustituye `[start, end)` y deja seleccionado lo nuevo. */
export function replaceRange(text: string, start: number, end: number, replacement: string): { text: string, start: number, end: number } {
  const from = Math.max(0, Math.min(start, end))
  const to = Math.min(text.length, Math.max(start, end))
  return { text: text.slice(0, from) + replacement + text.slice(to), start: from, end: from + replacement.length }
}

/** Contexto alrededor de una selección (para que el reescrito encaje), recortado. */
export function surrounding(text: string, start: number, end: number, size = 1_500): string {
  const before = text.slice(Math.max(0, start - size), start)
  const after = text.slice(end, end + size)
  return `${before}[…]${after}`.trim() === '[…]' ? '' : `${before}[…]${after}`
}

/** Mínimo de texto antes de proponer cómo seguir: con menos no hay contexto. */
export const GHOST_MIN_CHARS = 25

/** Pedir texto fantasma solo con el cursor al final, sin selección y con algo escrito. */
export function shouldRequestGhost(text: string, selectionStart: number, selectionEnd: number): boolean {
  if (selectionStart !== selectionEnd || selectionEnd !== text.length) return false
  if (text.trim().length < GHOST_MIN_CHARS) return false
  // Justo tras un salto de línea doble suele empezar algo nuevo: mejor no sugerir.
  return !/\n\s*\n\s*$/.test(text)
}

/** Máximo que se enseña: una sugerencia larga estorba más que ayuda. */
export const GHOST_MAX_CHARS = 180

/**
 * Limpia la continuación: sin comillas, sin repetir el final de lo escrito,
 * con el espacio justo al empezar y cortada en la primera línea.
 */
export function cleanGhost(before: string, raw: string): string {
  let text = raw.replace(/\r/g, '')
  if (/^\s*["“«]/.test(text) && /["”»]\s*$/.test(text)) text = text.trim().slice(1, -1)
  text = text.split('\n')[0] ?? ''
  // A veces repite el final de lo escrito: se quita el solape.
  const tail = before.slice(-60)
  for (let size = Math.min(tail.length, text.length); size >= 3; size--) {
    if (text.toLowerCase().startsWith(tail.slice(-size).toLowerCase())) {
      text = text.slice(size)
      break
    }
  }
  if (!text.trim()) return ''
  const needsSpace = /\S$/.test(before) && /^[\p{L}\p{N}(¿¡"]/u.test(text)
  const trimmedStart = /\s$/.test(before) ? text.replace(/^\s+/, '') : text
  const result = needsSpace ? ` ${trimmedStart.replace(/^\s+/, '')}` : trimmedStart
  return result.length > GHOST_MAX_CHARS ? `${result.slice(0, GHOST_MAX_CHARS).replace(/\s+\S*$/, '')}` : result
}

export interface ResolvedSuggestion {
  tracker_id?: string
  priority_id?: string
  description?: string
  estimated_hours?: string
}

/** Propuesta de la IA → valores del formulario, solo si existen en el proyecto. */
export function resolveSuggestion(
  suggestion: FieldSuggestion,
  catalog: { trackers: readonly { id: number, name: string }[], priorities: readonly { id: number, name: string }[] },
): ResolvedSuggestion {
  const out: ResolvedSuggestion = {}
  const tracker = suggestion.tracker ? matchByName(catalog.trackers, suggestion.tracker) : undefined
  const priority = suggestion.priority ? matchByName(catalog.priorities, suggestion.priority) : undefined
  if (tracker) out.tracker_id = String(tracker.id)
  if (priority) out.priority_id = String(priority.id)
  if (suggestion.description?.trim()) out.description = suggestion.description.trim()
  if (suggestion.estimated_hours && suggestion.estimated_hours > 0) out.estimated_hours = String(suggestion.estimated_hours)
  return out
}
