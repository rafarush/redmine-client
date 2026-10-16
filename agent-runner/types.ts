import type { RunnerEvent, TaskRequest } from '../shared/agent/events'

/** Evento sin el correlativo, que asigna el hub al emitirlo. */
export type EmitInput = Omit<RunnerEvent, 'id' | 'taskId'>

export interface TaskContext {
  emit: (event: EmitInput) => void
  /** Se activa al cancelar la tarea. */
  signal: AbortSignal
}

/**
 * Lo que de verdad hace el trabajo (F11-T03: rama, claude, pruebas, push, PR).
 * Debe terminar emitiendo `pr_opened` o `blocked`; si lanza un error, queda `blocked`.
 */
export interface TaskExecutor {
  run: (task: TaskRequest, ctx: TaskContext) => Promise<void>
}
