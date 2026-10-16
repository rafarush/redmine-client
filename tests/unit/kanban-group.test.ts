// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isKanbanMode, matrix, NO_SPRINT, sprintLanes, statusLanes } from '../../shared/kanban/group'

const statuses = [
  { id: 1, name: 'Nueva' },
  { id: 2, name: 'En curso' },
  { id: 3, name: 'Resuelta' },
  { id: 5, name: 'Cerrada', is_closed: true },
]
const versions = [
  { id: 20, name: 'Sprint 43', status: 'open', due_date: '2026-10-30' },
  { id: 10, name: 'Sprint 42', status: 'open', due_date: '2026-10-16' },
  { id: 30, name: 'Backlog', status: 'open', due_date: null },
  { id: 9, name: 'Sprint 41', status: 'closed', due_date: '2026-10-02' },
]
const issue = (id: number, status: number, version?: number) => ({ id, status: { id: status }, fixed_version: version ? { id: version } : undefined })
const issues = [issue(1, 1, 10), issue(2, 2, 10), issue(3, 2, 20), issue(4, 3), issue(5, 1, 999)]

describe('kanban', () => {
  it('por estado: los abiertos del catálogo en orden', () => {
    const lanes = statusLanes(issues, statuses)
    expect(lanes.map(l => l.label)).toEqual(['Nueva', 'En curso', 'Resuelta'])
    expect(lanes[1]!.issues.map(i => i.id)).toEqual([2, 3])
  })

  it('por sprint: del que vence antes al último, sin fecha detrás y "Sin sprint" al final', () => {
    const lanes = sprintLanes(issues, versions)
    expect(lanes.map(l => l.label)).toEqual(['Sprint 42', 'Sprint 43', 'Backlog', NO_SPRINT])
    // Sin versión o con una que no está en la lista.
    expect(lanes.at(-1)!.issues.map(i => i.id)).toEqual([4, 5])
  })

  it('matriz: una fila por sprint y una celda por estado', () => {
    const rows = matrix(issues, statuses, versions)
    expect(rows).toHaveLength(4)
    expect(rows[0]!.cells.map(c => c.issues.map(i => i.id))).toEqual([[1], [2], []])
  })

  it('valida el modo de la URL', () => {
    expect(isKanbanMode('sprint')).toBe(true)
    expect(isKanbanMode('otro')).toBe(false)
  })
})
