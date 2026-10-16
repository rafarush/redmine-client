// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { elapsedHours, formatClock, formatDuration, parseDuration, roundHours } from '../../shared/time/duration'
import { describeDue } from '../../shared/workspace/due'
import { currentTimer, doubleClickStep, elapsedMs, guessStatusMap, newTimer, pauseTimer, resumeTimer, runOnly, sanitizeTimers, stageOf, targetStatus } from '../../shared/workspace/flow'

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
    expect(stageOf(1, map, newTimer(7, 0))).toBe('in_progress')
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

describe('fecha fin', () => {
  it('dice hoy, mañana, ayer o la fecha corta con su tono', () => {
    expect(describeDue('2026-10-15', '2026-10-15')).toEqual({ label: 'Hoy', tone: 'today' })
    expect(describeDue('2026-10-16', '2026-10-15')).toEqual({ label: 'Mañana', tone: 'soon' })
    expect(describeDue('2026-10-14', '2026-10-15')).toEqual({ label: 'Ayer', tone: 'overdue' })
    expect(describeDue('2026-10-01', '2026-10-15')).toEqual({ label: '1 oct', tone: 'overdue' })
    expect(describeDue('2026-11-03', '2026-10-15')).toEqual({ label: '3 nov', tone: 'later' })
    expect(describeDue(null, '2026-10-15')).toEqual({ label: '—', tone: 'none' })
  })
})

describe('cronómetro con pausa', () => {
  const MIN = 60_000

  it('suma solo mientras corre', () => {
    let t = newTimer(7, 0)
    expect(elapsedMs(t, 10 * MIN)).toBe(10 * MIN)
    t = pauseTimer(t, 10 * MIN)
    expect(elapsedMs(t, 30 * MIN)).toBe(10 * MIN)
    t = resumeTimer(t, 30 * MIN)
    expect(elapsedMs(t, 35 * MIN)).toBe(15 * MIN)
    expect(pauseTimer(pauseTimer(t, 40 * MIN), 50 * MIN)).toEqual(pauseTimer(t, 40 * MIN))
  })

  it('arrancar otra tarea pausa la que corría y reanudar conserva lo medido', () => {
    let timers = runOnly([], 1, 0)
    timers = runOnly(timers, 2, 5 * MIN)
    expect(timers.find(t => t.issueId === 1)).toMatchObject({ paused: true, accumulatedMs: 5 * MIN })
    expect(currentTimer(timers)?.issueId).toBe(2)
    timers = runOnly(timers, 1, 8 * MIN)
    expect(timers.filter(t => !t.paused).map(t => t.issueId)).toEqual([1])
    expect(elapsedMs(timers.find(t => t.issueId === 1)!, 9 * MIN)).toBe(6 * MIN)
  })

  it('migra el formato sin pausa y no deja dos corriendo', () => {
    expect(sanitizeTimers([{ issueId: 3, startedAt: 100 }])).toEqual([{ issueId: 3, startedAt: 100, accumulatedMs: 0, paused: false }])
    const fixed = sanitizeTimers([{ issueId: 1, startedAt: 0 }, { issueId: 2, startedAt: 0 }, 'x', { issueId: 2, startedAt: 5 }])
    expect(fixed.map(t => [t.issueId, t.paused])).toEqual([[1, true], [2, false]])
  })
})
