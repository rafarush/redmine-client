import { TERMINAL_PHASES } from '../shared/agent/events'
import type { RunnerEvent, TaskRequest } from '../shared/agent/events'
import type { EmitInput, TaskExecutor } from './types'

const HISTORY_LIMIT = 500

type Listener = (event: RunnerEvent) => void

/** Reparte los eventos a los clientes SSE y guarda los últimos para reanudar. */
export class EventHub {
  private nextId = 1
  private history: RunnerEvent[] = []
  private listeners = new Set<Listener>()

  emit(taskId: string, input: EmitInput): RunnerEvent {
    const event: RunnerEvent = { ...input, id: this.nextId++, taskId }
    this.history.push(event)
    if (this.history.length > HISTORY_LIMIT) this.history.shift()
    for (const listener of this.listeners) listener(event)
    return event
  }

  /** Eventos posteriores a `afterId`, para quien se reconecta. */
  since(afterId: number): RunnerEvent[] {
    return this.history.filter(e => e.id > afterId)
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

/** Ejecuta una sola tarea a la vez; el orden de la cola lo decide la app. */
export class Scheduler {
  private current?: { id: string, controller: AbortController }

  constructor(private readonly hub: EventHub, private readonly executor: TaskExecutor) {}

  get busy(): boolean {
    return this.current !== undefined
  }

  /** `false` si ya hay una tarea en curso. */
  start(task: TaskRequest): boolean {
    if (this.current) return false
    const controller = new AbortController()
    this.current = { id: task.id, controller }
    void this.execute(task, controller)
    return true
  }

  cancel(id: string): boolean {
    if (this.current?.id !== id) return false
    this.current.controller.abort()
    return true
  }

  private async execute(task: TaskRequest, controller: AbortController) {
    let last: RunnerEvent['phase']
    const emit = (input: EmitInput) => {
      if (input.phase) last = input.phase
      this.hub.emit(task.id, input)
    }
    emit({ type: 'phase', phase: 'working' })
    try {
      await this.executor.run(task, { emit, signal: controller.signal })
      if (controller.signal.aborted && !isTerminal(last)) emit({ type: 'phase', phase: 'cancelled' })
      else if (!isTerminal(last)) emit({ type: 'phase', phase: 'blocked', reason: 'El agente terminó sin abrir la PR' })
    }
    catch (error) {
      if (isTerminal(last)) {
        // Ya informó de su resultado: el error no cambia nada.
      }
      else if (controller.signal.aborted) emit({ type: 'phase', phase: 'cancelled' })
      else emit({ type: 'phase', phase: 'blocked', reason: error instanceof Error ? error.message : String(error) })
    }
    finally {
      this.current = undefined
    }
  }
}

function isTerminal(phase: RunnerEvent['phase']): boolean {
  return phase !== undefined && TERMINAL_PHASES.includes(phase)
}
