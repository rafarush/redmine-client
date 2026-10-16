// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { describeDuration, formatHours, parseDuration } from '../../shared/time/duration'

describe('duraciones (F4-T01)', () => {
  it('acepta todas las formas del plan', () => {
    for (const [text, hours] of [['1h30', 1.5], ['1h 30m', 1.5], ['1:30', 1.5], ['1.5', 1.5], ['1,5', 1.5], ['90m', 1.5], ['2h', 2], ['45', 0.75]] as const)
      expect(parseDuration(text), text).toBe(hours)
  })

  it('rechaza cero, negativos y más de 24 h', () => {
    expect(parseDuration('0')).toBeNull()
    expect(parseDuration('-1')).toBeNull()
    expect(parseDuration('24:30')).toBeNull()
  })

  it('formatea en reloj compacto', () => {
    expect(formatHours(1.5)).toBe('1:30')
    expect(formatHours(0.75)).toBe('0:45')
    expect(formatHours(8)).toBe('8:00')
  })

  it('muestra la interpretación', () => {
    expect(describeDuration('45')).toEqual({ hours: 0.75, label: '= 45 min' })
    expect(describeDuration('mucho')?.hours).toBeNull()
    expect(describeDuration('  ')).toBeNull()
  })
})
