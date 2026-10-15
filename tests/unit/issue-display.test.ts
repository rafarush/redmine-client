import { describe, expect, it } from 'vitest'
import { isAttentionPriority, statusIcon, statusTone } from '../../shared/redmine/issue-display'

describe('issue-display', () => {
  it('marca como atención las prioridades altas en español e inglés', () => {
    for (const name of ['Alta', 'Urgente', 'Inmediata', 'High', 'Urgent', 'Immediate']) {
      expect(isAttentionPriority(name)).toBe(true)
    }
  })

  it('no marca normal ni baja', () => {
    for (const name of ['Normal', 'Baja', 'Low']) {
      expect(isAttentionPriority(name)).toBe(false)
    }
  })

  it('distingue abierta y cerrada con icono y tono', () => {
    expect(statusIcon(true)).toBe('lucide:circle-check')
    expect(statusIcon(false)).toBe('lucide:circle-dot')
    expect(statusTone(true)).toBe('success')
    expect(statusTone(false)).toBe('info')
  })
})
