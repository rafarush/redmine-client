import type { StatusMap } from './model'

/**
 * Flujo rápido de una card del workspace (F2c). Todo cambio va a Redmine al momento:
 *
 *   pendiente --doble clic--> en curso (+ cronómetro) --doble clic--> completada (+ tiempo registrado) --RTQA--> rtqa
 *
 * Mientras está en curso, el cronómetro se pausa y se reanuda (⏸/▶) sin tocar
 * Redmine; ⏹ registra lo medido en Redmine y lo cierra. El cronómetro vive en
 * local (`timers`); el estado, en Redmine. La etapa se deduce de los dos.
 */
export type CardStage = 'idle' | 'in_progress' | 'done' | 'rtqa'

/**
 * Cronómetro de una tarea. Cada tarea tiene el suyo y solo uno corre a la vez:
 * los demás quedan en pausa. El tiempo medido es `accumulatedMs` más, si corre,
 * lo que lleva desde `startedAt`.
 */
export interface Timer {
  issueId: number
  /** Inicio del tramo actual (ms desde epoch). */
  startedAt: number
  /** Tiempo de los tramos anteriores a la última pausa. */
  accumulatedMs: number
  /** En pausa: no suma tiempo hasta reanudar. */
  paused: boolean
}

export function newTimer(issueId: number, now: number): Timer {
  return { issueId, startedAt: now, accumulatedMs: 0, paused: false }
}

/** Tiempo medido hasta `now`. */
export function elapsedMs(timer: Timer, now: number): number {
  return timer.accumulatedMs + (timer.paused ? 0 : Math.max(0, now - timer.startedAt))
}

export function pauseTimer(timer: Timer, now: number): Timer {
  if (timer.paused) return timer
  return { ...timer, accumulatedMs: elapsedMs(timer, now), startedAt: now, paused: true }
}

export function resumeTimer(timer: Timer, now: number): Timer {
  if (!timer.paused) return timer
  return { ...timer, startedAt: now, paused: false }
}

/**
 * Arranca o reanuda el cronómetro de `issueId` y pausa el que estuviera corriendo:
 * nunca hay dos sumando tiempo a la vez.
 */
export function runOnly(timers: readonly Timer[], issueId: number, now: number): Timer[] {
  const others = timers.filter(t => t.issueId !== issueId).map(t => pauseTimer(t, now))
  const own = timers.find(t => t.issueId === issueId)
  return [...others, own ? resumeTimer(own, now) : newTimer(issueId, now)]
}

/** Tiempo que el flujo registró al completar, para poder ajustarlo después. */
export interface LoggedWork {
  issueId: number
  timeEntryId: number
  hours: number
}

export function stageOf(statusId: number, map: StatusMap, timer?: Timer): CardStage {
  if (timer) return 'in_progress'
  if (map.rtqa !== undefined && statusId === map.rtqa) return 'rtqa'
  if (map.done !== undefined && statusId === map.done) return 'done'
  if (map.inProgress !== undefined && statusId === map.inProgress) return 'in_progress'
  return 'idle'
}

export type FlowStep = 'start' | 'complete'

/** Qué hace el doble clic en cada etapa; en completada o RTQA no hace nada. */
export function doubleClickStep(stage: CardStage): FlowStep | null {
  if (stage === 'idle') return 'start'
  if (stage === 'in_progress') return 'complete'
  return null
}

/** Estado de Redmine al que lleva cada paso. */
export function targetStatus(step: FlowStep | 'rtqa', map: StatusMap): number | undefined {
  if (step === 'start') return map.inProgress
  if (step === 'complete') return map.done
  return map.rtqa
}

const GUESS: Record<keyof StatusMap, RegExp> = {
  inProgress: /en curso|en progreso|in progress|doing|trabajando/i,
  done: /resuelt|resolved|complet|terminad|hecha|done/i,
  rtqa: /rtqa|\bqa\b|ready for qa|para qa|en pruebas|testing|verificar/i,
}

/**
 * Propone el mapeo mirando los nombres de los estados de Redmine. RTQA se mira
 * antes que "completada" para que "Resuelta (QA)" no se quede en completada.
 */
export function guessStatusMap(statuses: ReadonlyArray<{ id: number, name: string, is_closed?: boolean }>): StatusMap {
  const find = (key: keyof StatusMap, exclude: Set<number>) =>
    statuses.find(status => !exclude.has(status.id) && GUESS[key].test(status.name))?.id
  const used = new Set<number>()
  const rtqa = find('rtqa', used)
  if (rtqa !== undefined) used.add(rtqa)
  const inProgress = find('inProgress', used)
  if (inProgress !== undefined) used.add(inProgress)
  const done = find('done', used)
  return { inProgress, done, rtqa }
}

/** El cronómetro de esta tarea, si lo hay (corriendo o en pausa). */
export function timerFor(timers: readonly Timer[], issueId: number): Timer | undefined {
  return timers.find(timer => timer.issueId === issueId)
}

/** El que está sumando tiempo ahora mismo; si ninguno, el último pausado. */
export function currentTimer(timers: readonly Timer[]): Timer | undefined {
  return timers.find(timer => !timer.paused) ?? timers.at(-1)
}

/**
 * Lo guardado en `localStorage` puede venir de la versión sin pausa
 * (`{ issueId, startedAt }`): se convierte a cronómetro corriendo.
 */
export function sanitizeTimers(raw: unknown): Timer[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<number>()
  const timers: Timer[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const t = item as Record<string, unknown>
    if (!Number.isInteger(t.issueId) || typeof t.startedAt !== 'number' || seen.has(t.issueId as number)) continue
    seen.add(t.issueId as number)
    timers.push({
      issueId: t.issueId as number,
      startedAt: t.startedAt,
      accumulatedMs: typeof t.accumulatedMs === 'number' && t.accumulatedMs >= 0 ? t.accumulatedMs : 0,
      paused: t.paused === true,
    })
  }
  // Si por algo hubiera dos corriendo, se queda corriendo solo el último.
  let running = false
  for (let i = timers.length - 1; i >= 0; i--) {
    if (!timers[i]!.paused) {
      if (running) timers[i] = { ...timers[i]!, paused: true }
      running = true
    }
  }
  return timers.slice(-20)
}
