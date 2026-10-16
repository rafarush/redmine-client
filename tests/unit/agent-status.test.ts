// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { canApplyStatus, statusForPhase } from '../../shared/agent/status'

describe('estado de Redmine según la fase (F11-T07)', () => {
  const map = { working: 2, pr_opened: 4 }

  it('solo las fases mapeadas cambian el estado', () => {
    expect(statusForPhase(map, 'working')).toBe(2)
    expect(statusForPhase(map, 'pr_opened')).toBe(4)
    expect(statusForPhase(map, 'blocked')).toBeUndefined()
    expect(statusForPhase(map, 'testing')).toBeUndefined()
    expect(statusForPhase(map, 'queued')).toBeUndefined()
  })

  it('respeta el workflow', () => {
    expect(canApplyStatus(2, 2)).toBe('already')
    expect(canApplyStatus(2, 1, [{ id: 2 }, { id: 3 }])).toBe('apply')
    expect(canApplyStatus(4, 1, [{ id: 2 }])).toBe('not_allowed')
    expect(canApplyStatus(4, 1)).toBe('apply')
  })
})
