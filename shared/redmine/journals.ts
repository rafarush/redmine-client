import type { Journal } from './types'

/**
 * Historial de una tarea (F3-T04): cada journal de Redmine es un comentario, unos
 * cambios de campo o las dos cosas. Aquí se pasan a frases cortas
 * ("Estado: Nueva → En curso") con los nombres de los catálogos.
 */

type Detail = Journal['details'][number]

/** Nombre de un valor por campo (`status_id` + `"2"` → "En curso"). */
export type ValueLookup = (field: string, id: string) => string | undefined

const ATTR_LABELS: Record<string, string> = {
  subject: 'Asunto',
  description: 'Descripción',
  status_id: 'Estado',
  tracker_id: 'Tipo',
  priority_id: 'Prioridad',
  assigned_to_id: 'Asignada a',
  category_id: 'Categoría',
  fixed_version_id: 'Sprint',
  project_id: 'Proyecto',
  parent_id: 'Tarea padre',
  start_date: 'Empieza',
  due_date: 'Vence',
  done_ratio: 'Hecho',
  estimated_hours: 'Estimado',
  is_private: 'Privada',
}

/** Campos cuyo valor es largo: se dice que cambió, sin copiar el texto. */
const LONG_FIELDS = new Set(['description'])

export interface DetailLine {
  label: string
  /** Texto completo: "Estado: Nueva → En curso". */
  text: string
}

function show(field: string, value: string | null | undefined, lookup?: ValueLookup): string | undefined {
  if (value === null || value === undefined || value === '') return undefined
  if (field === 'done_ratio') return `${value} %`
  if (field === 'is_private') return value === '1' || value === 'true' ? 'sí' : 'no'
  if (field === 'parent_id') return `#${value}`
  return lookup?.(field, value) ?? value
}

/** Una línea por cambio de campo, adjunto o relación. */
export function describeDetail(detail: Detail, lookup?: ValueLookup, customFields?: Map<number, string>): DetailLine {
  const { property, name, old_value: before, new_value: after } = detail

  if (property === 'attachment') {
    return after
      ? { label: 'Adjunto', text: `Adjunto añadido: ${after}` }
      : { label: 'Adjunto', text: `Adjunto quitado: ${before ?? name}` }
  }

  if (property === 'relation') {
    const target = after ?? before
    return { label: 'Relación', text: `${after ? 'Relación añadida' : 'Relación quitada'}: ${name.replaceAll('_', ' ')} #${target}` }
  }

  const label = property === 'cf'
    ? customFields?.get(Number(name)) ?? `Campo ${name}`
    : ATTR_LABELS[name] ?? name

  if (LONG_FIELDS.has(name)) return { label, text: `${label} actualizada` }

  const from = show(name, before, lookup)
  const to = show(name, after, lookup)
  if (from && to) return { label, text: `${label}: ${from} → ${to}` }
  if (to) return { label, text: `${label}: ${to}` }
  return { label, text: `${label}: quitado${from ? ` (${from})` : ''}` }
}

export interface TimelineItem {
  id: number
  author: string
  createdOn: string
  notes?: string
  private: boolean
  changes: DetailLine[]
}

/** Journals en orden cronológico, sin los vacíos (Redmine guarda algunos sin notas ni cambios). */
export function buildTimeline(journals: Journal[], lookup?: ValueLookup, customFields?: Map<number, string>): TimelineItem[] {
  return [...journals]
    .sort((a, b) => a.created_on.localeCompare(b.created_on) || a.id - b.id)
    .map(journal => ({
      id: journal.id,
      author: journal.user?.name ?? 'Alguien',
      createdOn: journal.created_on,
      notes: journal.notes?.trim() || undefined,
      private: !!journal.private_notes,
      changes: journal.details.map(d => describeDetail(d, lookup, customFields)),
    }))
    .filter(item => item.notes || item.changes.length > 0)
}
