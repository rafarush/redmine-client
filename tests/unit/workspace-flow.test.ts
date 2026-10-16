// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { elapsedHours, formatClock, formatDuration, parseDuration, roundHours } from '../../shared/time/duration'
import { doubleClickStep, guessStatusMap, stageOf, targetStatus } from '../../shared/workspace/flow'

describe('duraciones', () => {
  it('lee lo que escribe una persona', () => {
    expect(parseDuration('1,5')).toBe(1.5)
    expect(parseDuration('1:30')).toBe(1.5)
    expect(parseDuration('1h 30')).toBe(1.5)
    expect(parseDuration('1h30m')).toBe(1.5)
    expect(parseDuration('90m')).toBe(1.5)
    expect(parseDuration('45 min')).toBe(0.75)
    expect(parseDuration('2 h')).toBe(2)
    expect(parseDuration('45')).toBe(0.75)
    expect(parseDuration('25h')).toBeNull()
    expect(parseDuration('0')).toBeNull()
    expect(parseDuration('mucho')).toBeNull()
    expect(parseDuration('')).toBeNull()
  })

  it('redondea hacia arriba al paso y nunca registra cero', () => {
    expect(roundHours(elapsedHours(0, 60_000))).toBe(0.08)
    expect(roundHours(0.5)).toBe(0.5)
    expect(roundHours(0.51)).toBe(0.58)
    expect(roundHours(1.74, 15)).toBe(1.75)
  })

  it('muestra horas y cronómetro', () => {
    expect(formatDuration(1.75)).toBe('1 h 45 min')
    expect(formatDuration(0.5)).toBe('30 min')
    expect(formatDuration(2)).toBe('2 h')
    expect(formatClock(32 * 60_000 + 10_000)).toBe('00:32:10')
  })
})

describe('flujo de la card', () => {
  const map = { inProgress: 2, done: 3, rtqa: 5 }

  it('deduce la etapa del estado y del cronómetro', () => {
    expect(stageOf(1, map)).toBe('idle')
    expect(stageOf(1, map, { issueId: 7, startedAt: 0 })).toBe('in_progress')
    expect(stageOf(2, map)).toBe('in_progress')
    expect(stageOf(3, map)).toBe('done')
    expect(stageOf(5, map)).toBe('rtqa')
  })

  it('el doble clic arranca y luego completa', () => {
    expect(doubleClickStep('idle')).toBe('start')
    expect(doubleClickStep('in_progress')).toBe('complete')
    expect(doubleClickStep('done')).toBeNull()
    expect(targetStatus('start', map)).toBe(2)
    expect(targetStatus('complete', map)).toBe(3)
    expect(targetStatus('rtqa', map)).toBe(5)
  })

  it('adivina el mapeo por el nombre de los estados', () => {
    const statuses = [
      { id: 1, name: 'Nueva' },
      { id: 2, name: 'En curso' },
      { id: 3, name: 'Resuelta' },
      { id: 4, name: 'Comentarios' },
      { id: 5, name: 'Resuelta (QA)' },
      { id: 6, name: 'Cerrada', is_closed: true },
    ]
    expect(guessStatusMap(statuses)).toEqual({ inProgress: 2, done: 3, rtqa: 5 })
    expect(guessStatusMap([{ id: 1, name: 'Nueva' }])).toEqual({ inProgress: undefined, done: undefined, rtqa: undefined })
  })
})
