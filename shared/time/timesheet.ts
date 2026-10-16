import type { TimeEntry } from '../redmine/types'

/**
 * Parte semanal (F4-T06): la semana de lunes a domingo, las filas (una por tarea,
 * o por proyecto para lo registrado sin tarea), totales y qué hacer al escribir en
 * una celda. Las fechas van en `AAAA-MM-DD` locales, como `spent_on` en Redmine.
 */

const DAY_MS = 86_400_000

function toUtc(day: string): number {
  return Date.parse(`${day}T00:00:00Z`)
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Suma (o resta) días a una fecha `AAAA-MM-DD`. */
export function addDays(day: string, delta: number): string {
  return fromUtc(toUtc(day) + delta * DAY_MS)
}

export interface Week {
  /** Lunes. */
  from: string
  /** Domingo. */
  to: string
  /** Los siete días, de lunes a domingo. */
  days: string[]
}

/** Semana (lunes a domingo) que contiene `day`. */
export function weekOf(day: string): Week {
  const weekday = (new Date(toUtc(day)).getUTCDay() + 6) % 7 // lunes = 0
  const from = addDays(day, -weekday)
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i))
  return { from, to: days[6]!, days }
}

/** La semana anterior (`-1`) o siguiente (`1`). */
export function shiftWeek(week: Week, delta: number): Week {
  return weekOf(addDays(week.from, delta * 7))
}

export interface TimesheetRow {
  /** `issue:<id>` o `project:<id>` para lo registrado sin tarea. */
  key: string
  issueId?: number
  project: { id: number, name: string }
  /** Entradas de cada día de la semana, en el orden de `week.days`. */
  cells: TimeEntry[][]
  total: number
}

export interface Timesheet {
  rows: TimesheetRow[]
  /** Total por día, en el orden de `week.days`. */
  dayTotals: number[]
  total: number
}

export function sumHours(entries: TimeEntry[]): number {
  return round(entries.reduce((sum, entry) => sum + entry.hours, 0))
}

/** Redondea a centésimas para que 0.1 + 0.2 no deje restos en los totales. */
function round(hours: number): number {
  return Math.round(hours * 100) / 100
}

function rowKey(entry: Pick<TimeEntry, 'issue' | 'project'>): string {
  return entry.issue ? `issue:${entry.issue.id}` : `project:${entry.project.id}`
}

/**
 * Agrupa las entradas de la semana en filas. `extraIssues` son tareas añadidas a mano
 * ("Añadir tarea") que todavía no tienen tiempo: salen como filas vacías al final.
 * Las filas con tiempo van por proyecto y luego por número de tarea (lo que no
 * tiene tarea, al final de su proyecto).
 */
export function buildTimesheet(
  entries: TimeEntry[],
  week: Week,
  extraIssues: { id: number, project: { id: number, name: string } }[] = [],
): Timesheet {
  const index = new Map(week.days.map((day, i) => [day, i]))
  const rows = new Map<string, TimesheetRow>()

  for (const entry of entries) {
    const column = index.get(entry.spent_on)
    if (column === undefined) continue
    const key = rowKey(entry)
    let row = rows.get(key)
    if (!row) {
      row = { key, issueId: entry.issue?.id, project: { id: entry.project.id, name: entry.project.name }, cells: week.days.map(() => []), total: 0 }
      rows.set(key, row)
    }
    row.cells[column]!.push(entry)
  }

  const sorted = [...rows.values()]
    .map(row => ({ ...row, total: sumHours(row.cells.flat()) }))
    .sort((a, b) => a.project.name.localeCompare(b.project.name, 'es') || (a.issueId ?? Infinity) - (b.issueId ?? Infinity))

  for (const issue of extraIssues) {
    if (rows.has(`issue:${issue.id}`)) continue
    sorted.push({ key: `issue:${issue.id}`, issueId: issue.id, project: issue.project, cells: week.days.map(() => []), total: 0 })
  }

  const dayTotals = week.days.map((_, i) => sumHours(sorted.flatMap(row => row.cells[i]!)))
  return { rows: sorted, dayTotals, total: round(dayTotals.reduce((a, b) => a + b, 0)) }
}

export type CellEdit
  = | { kind: 'none' }
    | { kind: 'create', hours: number }
    | { kind: 'update', id: number, hours: number }
    | { kind: 'delete', id: number }
    | { kind: 'breakdown' }

/**
 * Qué pasa al escribir `hours` en una celda (`null` = la celda se vació):
 * sin entradas se crea; con una, se ajusta o se borra; con varias no se adivina
 * cuál tocar y se abre el desglose.
 */
export function planCellEdit(entries: TimeEntry[], hours: number | null): CellEdit {
  if (entries.length > 1) return { kind: 'breakdown' }
  const [entry] = entries
  if (!entry) return hours === null ? { kind: 'none' } : { kind: 'create', hours }
  if (hours === null) return { kind: 'delete', id: entry.id }
  return round(hours) === round(entry.hours) ? { kind: 'none' } : { kind: 'update', id: entry.id, hours }
}

export type GoalTone = 'none' | 'under' | 'met' | 'over'

/** Cómo va un día frente al objetivo diario. Sin objetivo (0) no se juzga. */
export function goalTone(hours: number, goal: number): GoalTone {
  if (goal <= 0 || hours === 0) return 'none'
  if (hours < goal) return 'under'
  return hours > goal ? 'over' : 'met'
}
