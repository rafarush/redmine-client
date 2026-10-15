// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { availableFields, dateRange, removeLast, setValues, toggleValue } from '../../shared/redmine/filter-fields'

describe('frase de filtros: edición', () => {
  it('marcar un valor crea el token y desmarcar el último lo quita', () => {
    const one = toggleValue({ conditions: [] }, 'status_id', 'open')
    expect(one.conditions).toEqual([{ field: 'status_id', operator: '=', values: ['open'] }])
    expect(toggleValue(one, 'status_id', 'open').conditions).toEqual([])
  })

  it('acumula varios valores en el mismo token', () => {
    let s = toggleValue({ conditions: [] }, 'status_id', '1')
    s = toggleValue(s, 'status_id', '2')
    expect(s.conditions[0]!.values).toEqual(['1', '2'])
  })

  it('el asunto nace con el operador de contiene', () => {
    expect(setValues({ conditions: [] }, 'subject', '~', ['login']).conditions[0]!.operator).toBe('~')
  })

  it('solo ofrece los campos que aún no están', () => {
    const s = toggleValue({ conditions: [] }, 'status_id', 'open')
    expect(availableFields(s)).not.toContain('status_id')
    expect(availableFields(s)).toContain('tracker_id')
  })

  it('traduce un rango de fechas al operador adecuado', () => {
    expect(dateRange('2026-10-01', '2026-10-31').operator).toBe('><')
    expect(dateRange('2026-10-01', '').operator).toBe('>=')
    expect(dateRange('', '2026-10-31').operator).toBe('<=')
    expect(dateRange('', '').values).toEqual([])
  })

  it('Retroceso quita la última condición', () => {
    let s = toggleValue({ conditions: [] }, 'status_id', 'open')
    s = toggleValue(s, 'tracker_id', '3')
    expect(removeLast(s).conditions.map(c => c.field)).toEqual(['status_id'])
  })
})
