// @vitest-environment node
import type { TimeEntry } from '../../shared/redmine/types'
import { describe, expect, it } from 'vitest'
import { addDays, buildTimesheet, goalTone, planCellEdit, shiftWeek, sumHours, weekOf } from '../../shared/time/timesheet'

let nextId = 1
function entry(spent_on: string, hours: number, issue?: number, project = { id: 1, name: 'Portal web' }): TimeEntry {
  return {
    id: nextId++,
    project,
    issue: issue ? { id: issue } : undefined,
    user: { id: 5, name: 'Ana' },
    activity: { id: 9, name: 'Desarrollo' },
    hours,
    comments: '',
    spent_on,
    created_on: `${spent_on}T10:00:00Z`,
    updated_on: `${spent_on}T10:00:00Z`,
  }
}

describe('semana', () => {
  it('va de lunes a domingo', () => {
    const week = weekOf('2026-10-15') // jueves
    expect(week.from).toBe('2026-10-12')
    expect(week.to).toBe('2026-10-18')
    expect(week.days).toHaveLength(7)
    expect(weekOf('2026-10-18').from).toBe('2026-10-12') // domingo
    expect(weekOf('2026-10-12').from).toBe('2026-10-12') // lunes
  })

  it('se desplaza y cruza meses y años', () => {
    expect(shiftWeek(weekOf('2026-10-15'), -1).from).toBe('2026-10-05')
    expect(shiftWeek(weekOf('2026-12-30'), 1).from).toBe('2027-01-04')
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
  })
})

describe('parte semanal', () => {
  const week = weekOf('2026-10-15')

  it('agrupa por tarea y deja lo que no tiene tarea por proyecto', () => {
    const sheet = buildTimesheet([
      entry('2026-10-12', 1.5, 10),
      entry('2026-10-12', 0.5, 10),
      entry('2026-10-13', 2, 11),
      entry('2026-10-14', 1),
      entry('2026-10-20', 4, 10), // fuera de la semana
    ], week)
    expect(sheet.rows.map(r => r.key)).toEqual(['issue:10', 'issue:11', 'project:1'])
    expect(sheet.rows[0]!.cells[0]).toHaveLength(2)
    expect(sheet.rows[0]!.total).toBe(2)
    expect(sheet.dayTotals.slice(0, 3)).toEqual([2, 2, 1])
    expect(sheet.total).toBe(5)
  })

  it('ordena por proyecto y añade al final las tareas sin tiempo', () => {
    const sheet = buildTimesheet(
      [entry('2026-10-12', 1, 30, { id: 2, name: 'Zeta' }), entry('2026-10-12', 1, 20, { id: 3, name: 'Alfa' })],
      week,
      [{ id: 99, project: { id: 2, name: 'Zeta' } }, { id: 20, project: { id: 3, name: 'Alfa' } }],
    )
    expect(sheet.rows.map(r => r.key)).toEqual(['issue:20', 'issue:30', 'issue:99'])
    expect(sheet.rows[2]!.total).toBe(0)
  })

  it('suma sin restos de coma flotante', () => {
    expect(sumHours([entry('2026-10-12', 0.1), entry('2026-10-12', 0.2)])).toBe(0.3)
  })
})

describe('editar una celda', () => {
  it('crea, ajusta, borra o pide el desglose', () => {
    const one = [entry('2026-10-12', 1)]
    expect(planCellEdit([], 1.5)).toEqual({ kind: 'create', hours: 1.5 })
    expect(planCellEdit([], null)).toEqual({ kind: 'none' })
    expect(planCellEdit(one, 2)).toEqual({ kind: 'update', id: one[0]!.id, hours: 2 })
    expect(planCellEdit(one, 1)).toEqual({ kind: 'none' })
    expect(planCellEdit(one, null)).toEqual({ kind: 'delete', id: one[0]!.id })
    expect(planCellEdit([...one, entry('2026-10-12', 1)], 3)).toEqual({ kind: 'breakdown' })
  })
})

describe('objetivo diario', () => {
  it('compara con el objetivo', () => {
    expect(goalTone(0, 8)).toBe('none')
    expect(goalTone(6, 8)).toBe('under')
    expect(goalTone(8, 8)).toBe('met')
    expect(goalTone(9, 8)).toBe('over')
    expect(goalTone(5, 0)).toBe('none')
  })
})
