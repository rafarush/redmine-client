import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from 'date-fns'

/**
 * La frase de filtros (F2-T01), en los tres formatos que necesita la app:
 *
 *   URL (`?f=`)  ←→  FilterSentence  →  query string de Redmine
 *                          ↓
 *                    texto accesible
 *
 * Tabla de equivalencias en sdd/03-api-redmine.md › Filtros.
 *
 * Las fechas relativas ("esta semana") se guardan como tales (`@this_week`) y se
 * resuelven al consultar, no al guardar: un enlace compartido el lunes tiene que
 * seguir diciendo "esta semana" el jueves.
 */

/** Campos que la frase sabe filtrar. `cf_<id>` son los campos personalizados. */
export type FilterField
  = | 'assigned_to_id'
    | 'author_id'
    | 'status_id'
    | 'tracker_id'
    | 'project_id'
    | 'subproject_id'
    | 'fixed_version_id'
    | 'priority_id'
    | 'category_id'
    | 'updated_on'
    | 'created_on'
    | 'due_date'
    | 'start_date'
    | 'subject'
    | `cf_${number}`

/** Operadores de Redmine. `*` es "cualquiera" y `!*` es "ninguno"; ninguno lleva valores. */
export type FilterOperator = '=' | '!' | '>=' | '<=' | '><' | '~' | '!~' | '*' | '!*'

export interface FilterCondition {
  field: FilterField
  operator: FilterOperator
  /** Ids, textos o fechas. Vacío para `*` y `!*`. */
  values: string[]
}

export interface FilterSentence {
  conditions: FilterCondition[]
}

export const EMPTY_SENTENCE: FilterSentence = { conditions: [] }

/** Operadores que no admiten valores: preguntan por la presencia del campo. */
const VALUELESS_OPERATORS = new Set<FilterOperator>(['*', '!*'])

const OPERATORS = new Set<FilterOperator>(['=', '!', '>=', '<=', '><', '~', '!~', '*', '!*'])

const DATE_FIELDS = new Set<FilterField>(['updated_on', 'created_on', 'due_date', 'start_date'])

export function isDateField(field: FilterField): boolean {
  return DATE_FIELDS.has(field)
}

// ------------------------------------------------------------ fechas relativas

/** Periodos que el popover de fechas ofrece como atajo. Se guardan sin resolver. */
export const RELATIVE_PERIODS = ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month'] as const
export type RelativePeriod = typeof RELATIVE_PERIODS[number]

/** Un valor relativo se escribe `@this_week` para no confundirlo con una fecha. */
export function relativeValue(period: RelativePeriod): string {
  return `@${period}`
}

export function isRelativeValue(value: string): value is `@${RelativePeriod}` {
  return value.startsWith('@') && (RELATIVE_PERIODS as readonly string[]).includes(value.slice(1))
}

/** La semana empieza en lunes: es lo que espera quien trabaja en español. */
const WEEK_OPTIONS = { weekStartsOn: 1 } as const

const isoDate = (date: Date): string => format(date, 'yyyy-MM-dd')

/** Resuelve `@this_week` al rango `[lunes, domingo]` de la semana de `now`. */
export function resolvePeriod(period: RelativePeriod, now: Date): [string, string] {
  switch (period) {
    case 'today':
      return [isoDate(now), isoDate(now)]
    case 'yesterday': {
      const day = subDays(now, 1)
      return [isoDate(day), isoDate(day)]
    }
    case 'this_week':
      return [isoDate(startOfWeek(now, WEEK_OPTIONS)), isoDate(endOfWeek(now, WEEK_OPTIONS))]
    case 'last_week': {
      const week = subWeeks(now, 1)
      return [isoDate(startOfWeek(week, WEEK_OPTIONS)), isoDate(endOfWeek(week, WEEK_OPTIONS))]
    }
    case 'this_month':
      return [isoDate(startOfMonth(now)), isoDate(endOfMonth(now))]
    case 'last_month': {
      const month = subMonths(now, 1)
      return [isoDate(startOfMonth(month)), isoDate(endOfMonth(month))]
    }
  }
}

/**
 * Deja la condición con fechas absolutas. Un periodo es un rango, así que según
 * el operador se usa su principio, su final o los dos.
 */
function resolveDates(condition: FilterCondition, now: Date): FilterCondition {
  if (!isDateField(condition.field)) return condition

  const [first] = condition.values
  if (condition.values.length !== 1 || !first || !isRelativeValue(first)) return condition

  const [start, end] = resolvePeriod(first.slice(1) as RelativePeriod, now)

  switch (condition.operator) {
    case '>=':
      return { ...condition, values: [start] }
    case '<=':
      return { ...condition, values: [end] }
    default:
      // Un día suelto se pregunta con `=`; un periodo, con el rango `><`.
      return start === end
        ? { ...condition, operator: '=', values: [start] }
        : { ...condition, operator: '><', values: [start, end] }
  }
}

// ---------------------------------------------------------- query de Redmine

/**
 * Frase → parámetros de `/issues.json`.
 *
 * `now` se pasa para poder probarlo y para que el servidor y el cliente
 * resuelvan "esta semana" contra el mismo instante.
 */
export function toRedmineQuery(
  sentence: FilterSentence,
  { now = new Date() }: { now?: Date } = {},
): Record<string, string> {
  const query: Record<string, string> = {}

  for (const raw of sentence.conditions) {
    const condition = resolveDates(raw, now)
    if (!VALUELESS_OPERATORS.has(condition.operator) && condition.values.length === 0) continue

    // `=` es el operador implícito de Redmine, así que no se escribe.
    const prefix = condition.operator === '=' ? '' : condition.operator
    query[condition.field] = `${prefix}${condition.values.join('|')}`
  }

  return query
}

// ---------------------------------------------------------------- URL (`?f=`)

/**
 * Frase → `?f=`. Cada condición es `campo:operador:valor|valor`, separadas por `;`.
 * Los valores van escapados, así que un texto con `;`, `:` o `|` sobrevive.
 */
export function toUrl(sentence: FilterSentence): string {
  return sentence.conditions
    .map(({ field, operator, values }) =>
      [field, encodeURIComponent(operator), values.map(encodeURIComponent).join('|')].join(':'),
    )
    .join(';')
}

/**
 * `?f=` → frase. Tolerante a propósito: un enlace viejo o manipulado pierde las
 * condiciones que no entendemos, en vez de dejar la pantalla rota.
 */
export function fromUrl(text: string | null | undefined): FilterSentence {
  if (!text) return { conditions: [] }

  const conditions: FilterCondition[] = []

  for (const chunk of text.split(';')) {
    if (!chunk) continue

    const [field, rawOperator = '', rawValues = ''] = chunk.split(':')
    if (!field || !isFilterField(field)) continue

    const operator = safeDecode(rawOperator)
    if (!OPERATORS.has(operator as FilterOperator)) continue

    const values = VALUELESS_OPERATORS.has(operator as FilterOperator)
      ? []
      : rawValues.split('|').map(safeDecode).filter(Boolean)

    if (values.length === 0 && !VALUELESS_OPERATORS.has(operator as FilterOperator)) continue

    conditions.push({ field: field as FilterField, operator: operator as FilterOperator, values })
  }

  return { conditions }
}

/** `decodeURIComponent` lanza con un `%` suelto; aquí eso solo significa "no lo entiendo". */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  }
  catch {
    return value
  }
}

const KNOWN_FIELDS = new Set<string>([
  'assigned_to_id', 'author_id', 'status_id', 'tracker_id', 'project_id', 'subproject_id',
  'fixed_version_id', 'priority_id', 'category_id',
  'updated_on', 'created_on', 'due_date', 'start_date', 'subject',
])

export function isFilterField(value: string): value is FilterField {
  return KNOWN_FIELDS.has(value) || /^cf_\d+$/.test(value)
}

// ------------------------------------------------------------ texto accesible

/** Conjunción que precede a cada campo, para que la frase se lea como tal. */
const FIELD_PHRASES: Record<string, string> = {
  assigned_to_id: 'asignadas a',
  author_id: 'creadas por',
  status_id: 'en',
  tracker_id: 'del tipo',
  project_id: 'de',
  subproject_id: 'con subproyectos',
  fixed_version_id: 'de la versión',
  priority_id: 'con prioridad',
  category_id: 'de la categoría',
  updated_on: 'actualizadas',
  created_on: 'creadas',
  due_date: 'que vencen',
  start_date: 'que empiezan',
  subject: 'que contienen',
}

const PERIOD_PHRASES: Record<RelativePeriod, string> = {
  today: 'hoy',
  yesterday: 'ayer',
  this_week: 'esta semana',
  last_week: 'la semana pasada',
  this_month: 'este mes',
  last_month: 'el mes pasado',
}

const STATUS_PHRASES: Record<string, string> = {
  'open': 'cualquier estado abierto',
  'closed': 'cualquier estado cerrado',
  '*': 'cualquier estado',
}

/** Traduce un id a su nombre. La devuelve el store de sesión, que tiene los catálogos. */
export type LabelLookup = (field: FilterField, value: string) => string | undefined

function describeValue(field: FilterField, value: string, lookup?: LabelLookup): string {
  if (value === 'me') return 'mí'
  if (isRelativeValue(value)) return PERIOD_PHRASES[value.slice(1) as RelativePeriod]
  if (field === 'status_id' && STATUS_PHRASES[value]) return STATUS_PHRASES[value]!
  return lookup?.(field, value) ?? value
}

export function describeCondition(condition: FilterCondition, lookup?: LabelLookup): string {
  const { lead, value } = describeConditionParts(condition, lookup)
  return lead ? `${lead} ${value}` : value
}

/**
 * La condición partida para pintarla en la frase (F2b): `lead` son las palabras de
 * unión, en texto secundario ("asignadas a", "que vencen desde"), y `value` lo que
 * se puede cambiar, que es el botón ("mí", "Abierta o En curso").
 */
export function describeConditionParts(condition: FilterCondition, lookup?: LabelLookup): { lead: string, value: string } {
  const phrase = FIELD_PHRASES[condition.field] ?? describeCustomField(condition.field, lookup)

  if (condition.operator === '*') return { lead: `con ${phrase}`, value: 'cualquiera' }
  if (condition.operator === '!*') return { lead: '', value: `sin ${phrase}` }

  const values = condition.values.map(value => describeValue(condition.field, value, lookup))
  const joined = condition.operator === '><' && values.length === 2
    ? `entre ${values[0]} y ${values[1]}`
    : listToText(values)

  // "no asignadas a mí" se entiende; "asignadas a no mí", no.
  if (condition.operator === '!' || condition.operator === '!~') return { lead: `no ${phrase}`, value: joined }
  if (condition.operator === '>=') return { lead: `${phrase} desde`, value: joined }
  if (condition.operator === '<=') return { lead: `${phrase} hasta`, value: joined }

  return { lead: phrase, value: joined }
}

function describeCustomField(field: FilterField, lookup?: LabelLookup): string {
  return lookup?.(field, '') ?? 'con el campo'
}

/** "Abierta, En curso o Resuelta": la última conjunción se lee mejor con "o". */
function listToText(values: string[]): string {
  if (values.length <= 1) return values[0] ?? ''
  return `${values.slice(0, -1).join(', ')} o ${values[values.length - 1]}`
}

/**
 * La frase en un texto corrido, para `aria-label` y para el resumen en compacto.
 * Sin condiciones es "Todas las tareas", no una cadena vacía.
 */
export function describe(sentence: FilterSentence, lookup?: LabelLookup): string {
  if (sentence.conditions.length === 0) return 'Todas las tareas'
  return `Tareas ${sentence.conditions.map(condition => describeCondition(condition, lookup)).join(', ')}`
}

// ------------------------------------------------------------------ utilidades

/**
 * Añade o reemplaza la condición de ese campo: un campo aparece una vez en la frase.
 * Al reemplazar mantiene su sitio, para que la frase no se reordene al tocar un token.
 */
export function withCondition(sentence: FilterSentence, condition: FilterCondition): FilterSentence {
  const exists = sentence.conditions.some(existing => existing.field === condition.field)

  if (!exists) return { conditions: [...sentence.conditions, condition] }
  return { conditions: sentence.conditions.map(existing => existing.field === condition.field ? condition : existing) }
}

export function withoutField(sentence: FilterSentence, field: FilterField): FilterSentence {
  return { conditions: sentence.conditions.filter(condition => condition.field !== field) }
}

export function conditionFor(sentence: FilterSentence, field: FilterField): FilterCondition | undefined {
  return sentence.conditions.find(condition => condition.field === field)
}
