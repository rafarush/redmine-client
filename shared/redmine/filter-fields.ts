import type { FilterCondition, FilterField, FilterSentence } from './filters'
import { conditionFor, withCondition, withoutField } from './filters'

/**
 * Qué campos ofrece la frase y cómo se editan (F2-T04). Lógica pura: los
 * componentes solo pintan lo que esto decide.
 *
 * Los campos personalizados (`cf_<id>`) llegan como `CustomFieldDef` (F2-T10):
 * de `/custom_fields.json` si la persona es admin, o deducidos de las tareas.
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

/** Campo personalizado que la frase sabe ofrecer (F2-T10). */
export interface CustomFieldDef {
  id: number
  name: string
  kind: FieldKind
  /** Valores para elegir cuando `kind` es `list`. */
  options?: FilterOption[]
}

export function customFieldKey(def: Pick<CustomFieldDef, 'id'>): FilterField {
  return `cf_${def.id}`
}

/** Etiqueta y tipo de editor de cualquier campo, también de los personalizados. */
export function fieldMeta(field: FilterField, customFields: readonly CustomFieldDef[] = []): FieldMeta | undefined {
  if (FIELD_META[field]) return FIELD_META[field]
  const def = customFields.find(d => customFieldKey(d) === field)
  return def ? { label: def.name, kind: def.kind } : undefined
}

/** Campos que todavía no están en la frase: cada uno aparece una sola vez. Los personalizados, al final. */
export function availableFields(sentence: FilterSentence, customFields: readonly CustomFieldDef[] = []): FilterField[] {
  return [...ADDABLE_FIELDS, ...customFields.map(customFieldKey)].filter(field => !conditionFor(sentence, field))
}

/** Condición con la que nace un token vacío, lista para elegir valores. */
export function emptyCondition(field: FilterField, customFields: readonly CustomFieldDef[] = []): FilterCondition {
  const kind = fieldMeta(field, customFields)?.kind
  return { field, operator: kind === 'text' ? '~' : '=', values: [] }
}

/** Formatos de Redmine que se filtran eligiendo entre valores. */
const LIST_FORMATS = new Set(['list', 'enumeration'])

/**
 * Campos de `/custom_fields.json` (solo admin): los de tareas marcados como
 * filtrables. Fechas como fecha, listas con sus valores y el resto como texto.
 */
export function customFieldsFromAdmin(raw: unknown): CustomFieldDef[] {
  if (!Array.isArray(raw)) return []
  return (raw as Record<string, unknown>[]).flatMap((field): CustomFieldDef[] => {
    if (field.customized_type !== 'issue' || field.is_filter === false || typeof field.id !== 'number' || typeof field.name !== 'string') return []
    const format = String(field.field_format ?? '')
    if (format === 'date') return [{ id: field.id, name: field.name, kind: 'date' }]
    if (format === 'bool') return [{ id: field.id, name: field.name, kind: 'list', options: [{ value: '1', label: 'Sí' }, { value: '0', label: 'No' }] }]
    if (LIST_FORMATS.has(format) && Array.isArray(field.possible_values)) {
      const options = (field.possible_values as { value?: unknown, label?: unknown }[])
        .filter(v => typeof v.value === 'string')
        .map(v => ({ value: String(v.value), label: String(v.label ?? v.value) }))
      return [{ id: field.id, name: field.name, kind: 'list', options }]
    }
    return [{ id: field.id, name: field.name, kind: 'text' }]
  })
}

/** Más valores distintos que esto y el campo se filtra escribiendo, no eligiendo. */
const MAX_SEEN_OPTIONS = 30

/**
 * Sin ser admin no se puede leer la definición de los campos: se deducen de las
 * tareas que ya se ven. Con pocos valores distintos se ofrecen para elegir.
 */
export function customFieldsFromIssues(issues: readonly { custom_fields?: { id: number, name: string, value: string | string[] | null }[] }[]): CustomFieldDef[] {
  const seen = new Map<number, { name: string, values: Set<string> }>()
  for (const issue of issues) {
    for (const field of issue.custom_fields ?? []) {
      const entry = seen.get(field.id) ?? { name: field.name, values: new Set<string>() }
      for (const value of Array.isArray(field.value) ? field.value : [field.value]) {
        if (value) entry.values.add(value)
      }
      seen.set(field.id, entry)
    }
  }
  return [...seen].map(([id, { name, values }]): CustomFieldDef => {
    const sorted = [...values].sort((a, b) => a.localeCompare(b, 'es'))
    return values.size > 0 && values.size <= MAX_SEEN_OPTIONS
      ? { id, name, kind: 'list', options: sorted.map(v => ({ value: v, label: v })) }
      : { id, name, kind: 'text' }
  }).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** Personas sin repetir y por nombre, mezclando las de varios orígenes. */
export function mergePeople(...lists: readonly FilterOption[][]): FilterOption[] {
  const byId = new Map<string, string>()
  for (const list of lists) {
    for (const person of list) byId.set(person.value, person.label)
  }
  return [...byId].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'es'))
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
