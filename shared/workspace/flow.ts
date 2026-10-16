import type { StatusMap } from './model'

/**
 * Flujo rápido de una card del workspace (F2c). Todo cambio va a Redmine al momento:
 *
 *   pendiente --doble clic--> en curso (+ cronómetro) --doble clic--> completada (+ tiempo registrado) --RTQA--> rtqa
 *
 * El cronómetro vive en local (`timers`); el estado, en Redmine. La etapa se deduce
 * de los dos.
 */
export type CardStage = 'idle' | 'in_progress' | 'done' | 'rtqa'

export interface Timer {
  issueId: number
  /** Instante de inicio (ms desde epoch). */
  startedAt: number
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

/** El temporizador de esta tarea, si lo hay. Solo puede haber uno activo. */
export function timerFor(timers: readonly Timer[], issueId: number): Timer | undefined {
  return timers.find(timer => timer.issueId === issueId)
}
