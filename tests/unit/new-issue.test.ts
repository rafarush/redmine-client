// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { emptyDraft, isDraftDirty, nextDraft, sanitizeDraft, toCreatePayload, validateDraft } from '../../shared/redmine/new-issue'

const base = emptyDraft({ project_id: '1', tracker_id: '2', priority_id: '4' })

describe('validación', () => {
  it('pide proyecto, tipo y asunto', () => {
    expect(validateDraft(emptyDraft())).toMatchObject({ project_id: 'Elige un proyecto', tracker_id: 'Elige un tipo', subject: 'Escribe el asunto' })
    expect(validateDraft({ ...base, subject: 'Arreglar login' })).toEqual({})
  })

  it('fechas, estimación, padre y campos obligatorios', () => {
    const errors = validateDraft({ ...base, subject: 'x', start_date: '2026-10-20', due_date: '2026-10-10', estimated_hours: 'mucho', parent_issue_id: 'abc' }, [7])
    expect(errors).toEqual({
      'due_date': 'No puede vencer antes de empezar',
      'estimated_hours': 'No se entiende (ej.: 4, 1h30)',
      'parent_issue_id': 'Número de tarea (ej.: 123)',
      'custom.7': 'Obligatorio',
    })
  })
})

describe('payload', () => {
  it('convierte y omite lo vacío', () => {
    expect(toCreatePayload({ ...base, subject: '  Login  ', estimated_hours: '40', parent_issue_id: '#12', custom: { 7: 'Acme', 8: ' ' } })).toEqual({
      project_id: 1,
      tracker_id: 2,
      priority_id: 4,
      subject: 'Login',
      estimated_hours: 40,
      parent_issue_id: 12,
      custom_fields: [{ id: 7, value: 'Acme' }],
    })
  })
})

describe('borrador', () => {
  it('sabe si hay algo escrito', () => {
    expect(isDraftDirty(base)).toBe(false)
    expect(isDraftDirty({ ...base, subject: 'a' })).toBe(true)
    expect(isDraftDirty({ ...base, custom: { 3: 'x' } })).toBe(true)
  })

  it('"Crear y otra" mantiene proyecto, tipo y prioridad', () => {
    expect(nextDraft({ ...base, subject: 'a', description: 'b' })).toEqual(base)
  })

  it('limpia lo guardado', () => {
    expect(sanitizeDraft({ subject: 'Hola', project_id: 3, custom: { 7: 'x', no: 'y' } })).toEqual(emptyDraft({ subject: 'Hola', custom: { 7: 'x' } }))
    expect(sanitizeDraft('basura')).toBeNull()
  })
})
