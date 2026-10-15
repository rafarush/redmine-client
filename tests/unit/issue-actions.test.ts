import { describe, expect, it } from 'vitest'
import { RedmineError } from '../../shared/redmine/transport'
import { applyChange, explainRejection, isNoop, statusOptions, toRedminePayload } from '../../shared/redmine/issue-actions'

const issue = {
  id: 10,
  subject: 'Login roto',
  status: { id: 1, name: 'Nueva' },
  priority: { id: 2, name: 'Normal' },
  assigned_to: { id: 5, name: 'Ana' },
} as never

const statuses = [{ id: 1, name: 'Nueva' }, { id: 2, name: 'En curso' }, { id: 3, name: 'Resuelta' }] as never
const priorities = [{ id: 2, name: 'Normal' }, { id: 3, name: 'Alta' }] as never

describe('statusOptions', () => {
  it('ofrece solo los estados permitidos y quita el actual', () => {
    expect(statusOptions(issue, statuses).map(s => s.id)).toEqual([2, 3])
    expect(statusOptions(issue, undefined)).toEqual([])
  })
})

describe('isNoop', () => {
  it('detecta cambios que no cambian nada', () => {
    expect(isNoop(issue, { status_id: 1 })).toBe(true)
    expect(isNoop(issue, { status_id: 2 })).toBe(false)
    expect(isNoop(issue, { assigned_to_id: null })).toBe(false)
  })
})

describe('applyChange y payload', () => {
  it('pinta el nuevo valor y solo envía lo que cambia', () => {
    const next = applyChange(issue as never, { status_id: 3, assigned_to_id: null }, { statuses: statuses as never, priorities: priorities as never, members: [] })
    expect(next.status.name).toBe('Resuelta')
    expect(next.assigned_to).toBeUndefined()
    expect(toRedminePayload({ status_id: 3, assigned_to_id: null })).toEqual({ status_id: 3, assigned_to_id: '' })
    expect(toRedminePayload({ priority_id: 3 })).toEqual({ priority_id: 3 })
  })
})

describe('explainRejection', () => {
  it('traduce el rechazo del workflow', () => {
    const error = new RedmineError(422, ['Status is invalid'])
    expect(explainRejection(error)).toBe('El flujo de trabajo no permite ese estado')
  })
  it('explica permisos, desconexión y 422 sin motivos', () => {
    expect(explainRejection(new RedmineError(403))).toMatch(/permiso/)
    expect(explainRejection(new RedmineError(422))).toBe('Redmine no aceptó el cambio.')
    expect(explainRejection(new TypeError('network'))).toMatch(/conectar/)
  })
})
