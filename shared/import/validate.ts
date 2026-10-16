import type { ImportCatalog, NamedRef } from './model'
import type { RawRow, TemplateMeta } from './read'
import { matchByName, REPORT_CREATED_ID } from './model'
import { parseDuration } from '../time/duration'

/**
 * Validar las filas de un libro contra el proyecto (F5-T02): obligatorios, valores
 * que existen (sin distinguir mayúsculas ni acentos), fechas, estimación, padres
 * existentes y sin ciclos. Puro y síncrono: el preview lo vuelve a llamar cada vez
 * que se corrige una celda o se excluye una fila.
 */

export interface ImportError {
  line: number
  /** Cabecera de la columna, o `''` si es de la fila entera. */
  column: string
  message: string
}

export type ParentRef = { kind: 'row', fila: number } | { kind: 'issue', id: number }

export interface ImportRow {
  line: number
  /** Número de la columna Fila (para referenciar padres). */
  fila: number | null
  cells: Record<string, string>
  /** Cuerpo de `POST /issues.json` sin el padre; `null` si la fila tiene errores. */
  payload: Record<string, unknown> | null
  parent: ParentRef | null
}

export interface ValidationResult {
  rows: ImportRow[]
  errors: ImportError[]
  /** Filas que ya tienen `ID creado` (de un reporte): no se vuelven a crear. */
  skipped: { line: number, id: number }[]
}

export interface ValidateOptions {
  /** Filas (por `line`) que la persona excluyó en el preview. */
  excluded?: ReadonlySet<number>
  /** Tareas que existen, para comprobar los padres `#id`. Sin ella, no se comprueban. */
  existingIssueIds?: ReadonlySet<number>
}

/** Si la plantilla es de otro proyecto, el mensaje para la persona; si no, `null`. */
export function projectMismatch(meta: TemplateMeta, catalog: ImportCatalog): string | null {
  if (meta.projectId === catalog.project.id) return null
  return `Esta plantilla es del proyecto ${meta.projectName || meta.projectIdentifier || `#${meta.projectId}`}. Descarga la de ${catalog.project.name} o cambia de proyecto.`
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/
const DMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

/** Fecha escrita a mano o leída de Excel → `AAAA-MM-DD`; `undefined` si no es válida. */
export function parseDate(text: string): string | undefined {
  const iso = ISO.exec(text)
  const dmy = DMY.exec(text)
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]] : dmy ? [dmy[3], dmy[2], dmy[1]] : []
  if (!y) return undefined
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
  if (date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) return undefined
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Estimación: un número son horas (puede pasar de 24); si no, una duración ("1h30"). */
export function parseEstimate(text: string): number | undefined {
  if (/^\d+(?:[.,]\d+)?$/.test(text)) {
    const n = Number(text.replace(',', '.'))
    return n > 0 ? n : undefined
  }
  return parseDuration(text) ?? undefined
}

export function validateRows(rawRows: RawRow[], catalog: ImportCatalog, options: ValidateOptions = {}): ValidationResult {
  const errors: ImportError[] = []
  const skipped: ValidationResult['skipped'] = []
  const rows: ImportRow[] = []

  for (const raw of rawRows) {
    const created = Number(raw.cells[REPORT_CREATED_ID])
    if (Number.isInteger(created) && created > 0) {
      skipped.push({ line: raw.line, id: created })
      continue
    }
    if (options.excluded?.has(raw.line)) continue
    rows.push(validateRow(raw, catalog, errors, options))
  }

  checkParents(rows, errors, options)
  // Una fila con algún error no se envía.
  const withErrors = new Set(errors.map(e => e.line))
  for (const row of rows) {
    if (withErrors.has(row.line)) row.payload = null
  }
  return { rows, errors, skipped }
}

function validateRow(raw: RawRow, catalog: ImportCatalog, errors: ImportError[], options: ValidateOptions): ImportRow {
  const { cells, line } = raw
  const fail = (column: string, message: string) => errors.push({ line, column, message })
  const payload: Record<string, unknown> = { project_id: catalog.project.id }

  const filaText = cells.Fila ?? ''
  const fila = /^\d+$/.test(filaText) ? Number(filaText) : null
  if (filaText && fila === null) fail('Fila', 'Tiene que ser un número')

  const subject = (cells.Asunto ?? '').trim()
  if (!subject) fail('Asunto', 'Obligatorio')
  else if (subject.length > 255) fail('Asunto', 'Máximo 255 caracteres')
  else payload.subject = subject

  const lookup = (column: string, list: readonly NamedRef[], key: string, required = false) => {
    const value = (cells[column] ?? '').trim()
    if (!value) {
      if (required) fail(column, 'Obligatorio')
      return
    }
    const found = matchByName(list, value)
    if (found) payload[key] = found.id
    else fail(column, `"${value}" no existe en ${catalog.project.name}`)
  }
  lookup('Tracker', catalog.trackers, 'tracker_id', true)
  lookup('Estado', catalog.statuses, 'status_id')
  lookup('Prioridad', catalog.priorities, 'priority_id')
  lookup('Asignado a', catalog.members, 'assigned_to_id')
  lookup('Versión', catalog.versions, 'fixed_version_id')
  lookup('Categoría', catalog.categories, 'category_id')

  const description = cells['Descripción'] ?? ''
  if (description.trim()) payload.description = description

  const dates: Record<string, string | undefined> = {}
  for (const [column, key] of [['Fecha de inicio', 'start_date'], ['Fecha de fin', 'due_date']] as const) {
    const value = (cells[column] ?? '').trim()
    if (!value) continue
    const date = parseDate(value)
    if (!date) fail(column, 'Fecha no válida (AAAA-MM-DD)')
    else {
      payload[key] = date
      dates[key] = date
    }
  }
  if (dates.start_date && dates.due_date && dates.due_date < dates.start_date) fail('Fecha de fin', 'Es anterior a la fecha de inicio')

  const estimate = (cells['Estimación (h)'] ?? '').trim()
  if (estimate) {
    const hours = parseEstimate(estimate)
    if (hours === undefined) fail('Estimación (h)', 'No se entiende (ej.: 4, 1h30)')
    else payload.estimated_hours = hours
  }

  let parent: ParentRef | null = null
  const parentText = (cells['Padre (fila)'] ?? '').trim()
  if (parentText) {
    const issue = /^#(\d+)$/.exec(parentText)
    if (issue) {
      parent = { kind: 'issue', id: Number(issue[1]) }
      if (options.existingIssueIds && !options.existingIssueIds.has(parent.id)) fail('Padre (fila)', `La tarea #${parent.id} no existe o no la ves`)
    }
    else if (/^\d+$/.test(parentText)) parent = { kind: 'row', fila: Number(parentText) }
    else fail('Padre (fila)', 'Número de fila o #id de una tarea')
  }

  const custom: { id: number, value: string }[] = []
  for (const field of catalog.customFields) {
    const value = (cells[field.name] ?? '').trim()
    if (!value) continue
    if (field.options?.length) {
      const option = field.options.find(o => matchByName([{ name: o }], value))
      if (option) custom.push({ id: field.id, value: option })
      else fail(field.name, `"${value}" no es un valor de ${field.name}`)
    }
    else custom.push({ id: field.id, value })
  }
  if (custom.length > 0) payload.custom_fields = custom

  return { line, fila, cells, payload, parent }
}

/** Filas repetidas, padres que no están (o están excluidos) y ciclos. */
function checkParents(rows: ImportRow[], errors: ImportError[], options: ValidateOptions): void {
  const byFila = new Map<number, ImportRow>()
  for (const row of rows) {
    if (row.fila === null) continue
    if (byFila.has(row.fila)) errors.push({ line: row.line, column: 'Fila', message: `La fila ${row.fila} está repetida` })
    else byFila.set(row.fila, row)
  }

  for (const row of rows) {
    if (row.parent?.kind !== 'row') continue
    if (row.parent.fila === row.fila) {
      errors.push({ line: row.line, column: 'Padre (fila)', message: 'Una tarea no puede ser su propio padre' })
      continue
    }
    if (!byFila.has(row.parent.fila)) {
      errors.push({ line: row.line, column: 'Padre (fila)', message: options.excluded?.size ? `La fila ${row.parent.fila} no está o está excluida` : `La fila ${row.parent.fila} no está` })
    }
  }

  // Ciclos: 1 → 2 → 3 → 1. Se marca cada fila del ciclo.
  const state = new Map<number, 'visiting' | 'done'>()
  const inCycle = new Set<number>()
  const visit = (fila: number, path: number[]): void => {
    if (state.get(fila) === 'done') return
    if (state.get(fila) === 'visiting') {
      for (const f of path.slice(path.indexOf(fila))) inCycle.add(f)
      return
    }
    state.set(fila, 'visiting')
    const parent = byFila.get(fila)?.parent
    if (parent?.kind === 'row' && byFila.has(parent.fila) && parent.fila !== fila) visit(parent.fila, [...path, fila])
    state.set(fila, 'done')
  }
  for (const fila of byFila.keys()) visit(fila, [])
  for (const fila of inCycle) {
    errors.push({ line: byFila.get(fila)!.line, column: 'Padre (fila)', message: 'Los padres forman un ciclo' })
  }
}
