import type { FilterCondition, FilterField, FilterSentence } from './filters'
import { conditionFor, withCondition, withoutField } from './filters'

/**
 * Qué campos ofrece la frase y cómo se editan (F2-T04). Lógica pura: los
 * componentes solo pintan lo que esto decide.
 *
 * Los campos personalizados (`cf_<id>`) quedan fuera por ahora: ver F2-T10.
 */
export type FieldKind = 'list' | 'date' | 'text'

export interface FieldMeta {
  label: string
  kind: FieldKind
}

export const FIELD_META: Partial<Record<FilterField, FieldMeta>> = {
  status_id: { label: 'Estado', kind: 'list' },
  assigned_to_id: { label: 'Asignado a', kind: 'list' },
  author_id: { label: 'Autor', kind: 'list' },
  project_id: { label: 'Proyecto', kind: 'list' },
  tracker_id: { label: 'Tipo', kind: 'list' },
  priority_id: { label: 'Prioridad', kind: 'list' },
  updated_on: { label: 'Actualizada', kind: 'date' },
  created_on: { label: 'Creada', kind: 'date' },
  due_date: { label: 'Vence', kind: 'date' },
  start_date: { label: 'Empieza', kind: 'date' },
  subject: { label: 'Asunto contiene', kind: 'text' },
}

/** Orden en que se ofrecen al añadir una condición. */
export const ADDABLE_FIELDS = Object.keys(FIELD_META) as FilterField[]

export interface FilterOption {
  value: string
  label: string
}

/** Campos que todavía no están en la frase: cada uno aparece una sola vez. */
export function availableFields(sentence: FilterSentence): FilterField[] {
  return ADDABLE_FIELDS.filter(field => !conditionFor(sentence, field))
}

/** Condición con la que nace un token vacío, lista para elegir valores. */
export function emptyCondition(field: FilterField): FilterCondition {
  return { field, operator: field === 'subject' ? '~' : '=', values: [] }
}

/**
 * Marca o desmarca un valor. Sin valores el token no significa nada, así que
 * desmarcar el último lo quita de la frase.
 */
export function toggleValue(sentence: FilterSentence, field: FilterField, value: string): FilterSentence {
  const current = conditionFor(sentence, field) ?? emptyCondition(field)
  const values = current.values.includes(value)
    ? current.values.filter(existing => existing !== value)
    : [...current.values, value]

  return values.length === 0
    ? withoutField(sentence, field)
    : withCondition(sentence, { ...current, values })
}

/** Sustituye los valores de golpe (fechas y texto). Vacío quita el token. */
export function setValues(
  sentence: FilterSentence,
  field: FilterField,
  operator: FilterCondition['operator'],
  values: string[],
): FilterSentence {
  const clean = values.filter(Boolean)
  return clean.length === 0
    ? withoutField(sentence, field)
    : withCondition(sentence, { field, operator, values: clean })
}

/** Rango desde/hasta → operador y valores: ambos `><`, uno solo `>=` o `<=`. */
export function dateRange(from: string, to: string): Pick<FilterCondition, 'operator' | 'values'> {
  if (from && to) return { operator: '><', values: [from, to] }
  if (from) return { operator: '>=', values: [from] }
  if (to) return { operator: '<=', values: [to] }
  return { operator: '=', values: [] }
}

/** Quita la última condición: lo que hace Retroceso con el foco en la frase. */
export function removeLast(sentence: FilterSentence): FilterSentence {
  return { conditions: sentence.conditions.slice(0, -1) }
}
