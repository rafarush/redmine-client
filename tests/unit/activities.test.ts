// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { topActivities } from '../../shared/time/activities'

const catalog = [
  { id: 1, name: 'Diseño' },
  { id: 2, name: 'Desarrollo', is_default: true },
  { id: 3, name: 'Reunión' },
  { id: 4, name: 'Revisión' },
]
const entry = (project: number, activity: number, spent_on: string) => ({
  project: { id: project, name: '' },
  activity: { id: activity, name: '' },
  spent_on,
  created_on: `${spent_on}T10:00:00Z`,
})

describe('actividades del popover', () => {
  it('las más usadas en el proyecto y la última preseleccionada', () => {
    const result = topActivities([
      entry(1, 4, '2026-10-01'),
      entry(1, 4, '2026-10-02'),
      entry(1, 3, '2026-10-10'),
      entry(2, 1, '2026-10-12'), // otro proyecto: no cuenta
    ], 1, catalog)
    expect(result.top.map(a => a.id)).toEqual([4, 3, 2])
    expect(result.preferred).toBe(3)
  })

  it('sin historial: la de por defecto primero', () => {
    const result = topActivities([], 1, catalog)
    expect(result.top.map(a => a.id)).toEqual([2, 1, 3])
    expect(result.preferred).toBe(2)
  })
})
