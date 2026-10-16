// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  availableFields,
  categoryOptions,
  customFieldsFromAdmin,
  customFieldsFromIssues,
  dateRange,
  emptyCondition,
  fieldMeta,
  mergePeople,
  removeLast,
  setValues,
  toggleValue,
} from '../../shared/redmine/filter-fields'

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

describe('campos personalizados y personas (F2-T10)', () => {
  it('lee las definiciones de admin: solo de tareas y filtrables', () => {
    const defs = customFieldsFromAdmin([
      { id: 1, name: 'Cliente', customized_type: 'issue', is_filter: true, field_format: 'list', possible_values: [{ value: 'Acme' }, { value: 'Beta', label: 'Beta S.L.' }] },
      { id: 2, name: 'Entrega', customized_type: 'issue', is_filter: true, field_format: 'date' },
      { id: 3, name: 'Oculto', customized_type: 'issue', is_filter: false, field_format: 'string' },
      { id: 4, name: 'De usuario', customized_type: 'user', is_filter: true, field_format: 'string' },
      { id: 5, name: 'Notas', customized_type: 'issue', is_filter: true, field_format: 'text' },
    ])
    expect(defs.map(d => [d.id, d.kind])).toEqual([[1, 'list'], [2, 'date'], [5, 'text']])
    expect(defs[0]!.options).toEqual([{ value: 'Acme', label: 'Acme' }, { value: 'Beta', label: 'Beta S.L.' }])
  })

  it('sin admin, los deduce de las tareas vistas', () => {
    const defs = customFieldsFromIssues([
      { custom_fields: [{ id: 1, name: 'Cliente', value: 'Beta' }, { id: 7, name: 'Etiquetas', value: ['a', 'b'] }] },
      { custom_fields: [{ id: 1, name: 'Cliente', value: 'Acme' }, { id: 9, name: 'Vacío', value: null }] },
    ])
    expect(defs.map(d => d.name)).toEqual(['Cliente', 'Etiquetas', 'Vacío'])
    expect(defs[0]!.options?.map(o => o.value)).toEqual(['Acme', 'Beta'])
    expect(defs[2]!.kind).toBe('text')
  })

  it('los ofrece en "+ Filtro" y nacen con el operador de su tipo', () => {
    const defs = [{ id: 1, name: 'Cliente', kind: 'list' as const }, { id: 5, name: 'Notas', kind: 'text' as const }]
    expect(availableFields({ conditions: [] }, defs).slice(-2)).toEqual(['cf_1', 'cf_5'])
    expect(fieldMeta('cf_5', defs)).toEqual({ label: 'Notas', kind: 'text' })
    expect(emptyCondition('cf_5', defs).operator).toBe('~')
    expect(emptyCondition('cf_1', defs).operator).toBe('=')
  })

  it('mezcla personas sin repetir', () => {
    expect(mergePeople([{ value: '2', label: 'Zoe' }], [{ value: '1', label: 'Ana' }, { value: '2', label: 'Zoe' }]))
      .toEqual([{ value: '1', label: 'Ana' }, { value: '2', label: 'Zoe' }])
  })
})

describe('categorías de tareas', () => {
  it('se ofrece como campo de la frase', () => {
    expect(fieldMeta('category_id')).toEqual({ label: 'Categoría', kind: 'list' })
  })

  it('junta las de varios proyectos y distingue los nombres repetidos', () => {
    const options = categoryOptions([
      { name: 'Portal', categories: [{ id: 1, name: 'Soporte' }, { id: 2, name: 'Bug' }] },
      { name: 'Intranet', categories: [{ id: 7, name: 'Soporte' }] },
    ])
    expect(options).toEqual([
      { value: '2', label: 'Bug' },
      { value: '7', label: 'Soporte (Intranet)' },
      { value: '1', label: 'Soporte (Portal)' },
    ])
  })
})
