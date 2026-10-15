import { describe, expect, it } from 'vitest'
import { PRIORITY_ICON, isAttentionPriority, priorityLevel, projectCode, statusIcon, statusTone } from '../../shared/redmine/issue-display'

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

  it('abrevia el proyecto a un código de 3 letras', () => {
    expect(projectCode('Portal clientes')).toBe('PCL')
    expect(projectCode('App móvil')).toBe('AMO')
    expect(projectCode('Integraciones')).toBe('INT')
    expect(projectCode('Gestión de nóminas y vacaciones')).toBe('GNV')
    expect(projectCode('  ')).toBe('—')
  })

  it('sitúa la prioridad respecto a la de por defecto', () => {
    expect(priorityLevel(0, 1)).toBe('low')
    expect(priorityLevel(1, 1)).toBe('normal')
    expect(priorityLevel(2, 1)).toBe('high')
    expect(priorityLevel(4, 1)).toBe('urgent')
    expect(PRIORITY_ICON.urgent).toBe('lucide:chevrons-up')
  })
})
