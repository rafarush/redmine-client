// @vitest-environment node
import type { Issue } from '../../shared/redmine/types'
import { describe, expect, it } from 'vitest'
import { canEditIssue, currentFieldValue, toFieldPayload } from '../../shared/redmine/issue-fields'

const issue = {
  id: 1,
  project: { id: 3, name: 'P' },
  tracker: { id: 1, name: 'Bug' },
  status: { id: 2, name: 'En curso' },
  priority: { id: 4, name: 'Normal' },
  author: { id: 5, name: 'Ana' },
  subject: 'x',
  start_date: '2026-10-10',
  due_date: '2026-10-20',
  done_ratio: 30,
  estimated_hours: 4,
  created_on: '',
  updated_on: '',
  custom_fields: [{ id: 7, name: 'Cliente', value: 'Acme' }],
} as Issue

describe('payload de un campo', () => {
  it('listas por id y vaciar', () => {
    expect(toFieldPayload('status_id', '3', issue)).toEqual({ ok: true, payload: { status_id: 3 } })
    expect(toFieldPayload('assigned_to_id', '', issue)).toEqual({ ok: true, payload: { assigned_to_id: '' } })
  })

  it('fechas coherentes con la otra fecha', () => {
    expect(toFieldPayload('due_date', '2026-10-05', issue)).toEqual({ ok: false, error: 'No puede vencer antes de empezar' })
    expect(toFieldPayload('start_date', '2026-10-25', issue)).toEqual({ ok: false, error: 'No puede empezar después de vencer' })
    expect(toFieldPayload('due_date', '', issue)).toEqual({ ok: true, payload: { due_date: null } })
  })

  it('estimación como duración o como número de horas, también > 24', () => {
    expect(toFieldPayload('estimated_hours', '1h30', issue)).toEqual({ ok: true, payload: { estimated_hours: 1.5 } })
    expect(toFieldPayload('estimated_hours', '40', issue)).toEqual({ ok: true, payload: { estimated_hours: 40 } })
    expect(toFieldPayload('estimated_hours', 'mucho', issue).ok).toBe(false)
  })

  it('% hecho y campos personalizados', () => {
    expect(toFieldPayload('done_ratio', '50', issue)).toEqual({ ok: true, payload: { done_ratio: 50 } })
    expect(toFieldPayload('done_ratio', '150', issue).ok).toBe(false)
    expect(toFieldPayload('cf_7', ' Beta ', issue)).toEqual({ ok: true, payload: { custom_fields: [{ id: 7, value: 'Beta' }] } })
  })
})

describe('valor actual y permiso', () => {
  it('lee el valor actual como texto', () => {
    expect(currentFieldValue('status_id', issue)).toBe('2')
    expect(currentFieldValue('assigned_to_id', issue)).toBe('')
    expect(currentFieldValue('cf_7', issue)).toBe('Acme')
  })

  it('edit_own_issues solo vale para las propias', () => {
    const can = (permission: string) => permission === 'edit_own_issues'
    expect(canEditIssue(issue, 5, can)).toBe(true)
    expect(canEditIssue(issue, 6, can)).toBe(false)
    expect(canEditIssue(issue, 6, () => true)).toBe(true)
  })
})
