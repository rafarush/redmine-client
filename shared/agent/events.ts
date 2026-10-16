import { z } from 'zod'
import type { QueueStatus } from './model'

/**
 * Contrato entre el runner local y la app (F11): lo que el runner emite por SSE y lo que
 * recibe al encolar. Lo usan los dos lados, así que vive en `shared/`.
 */

export interface RunnerEvent {
  /** Correlativo por runner; sirve para reanudar con `Last-Event-ID`. */
  id: number
  taskId: string
  type: 'phase' | 'log'
  phase?: QueueStatus
  line?: string
  branch?: string
  prUrl?: string
  reason?: string
}

const eventSchema = z.object({
  id: z.number().int().nonnegative(),
  taskId: z.string().min(1),
  type: z.enum(['phase', 'log']),
  phase: z.enum(['queued', 'working', 'testing', 'pr_opened', 'blocked', 'cancelled']).optional(),
  line: z.string().optional(),
  branch: z.string().optional(),
  prUrl: z.string().optional(),
  reason: z.string().optional(),
})

export function parseRunnerEvent(data: string): RunnerEvent | undefined {
  try {
    const parsed = eventSchema.safeParse(JSON.parse(data))
    return parsed.success ? parsed.data : undefined
  }
  catch {
    return undefined
  }
}

export function formatSse(event: RunnerEvent): string {
  return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

/** Fases con las que una tarea ya no avanza sola. */
export const TERMINAL_PHASES: readonly QueueStatus[] = ['pr_opened', 'blocked', 'cancelled']

/** Lo que la app manda al runner. Sin rutas ni comandos: esos viven en la config del runner. */
export const BRANCH_PATTERN = /^(?!-)(?!.*\.\.)[\w./-]+$/

export const taskRequestSchema = z.object({
  id: z.string().min(1).max(64),
  issueId: z.number().int().positive(),
  title: z.string().min(1).max(255),
  description: z.string().max(20_000).default(''),
  comments: z.array(z.string().max(5_000)).max(50).default([]),
  baseBranch: z.string().max(100).regex(BRANCH_PATTERN),
})

export type TaskRequest = z.infer<typeof taskRequestSchema>

/**
 * Lector incremental de SSE para un `fetch` en streaming (EventSource no admite cabeceras,
 * y el token va en `Authorization`). Acepta trozos partidos en cualquier punto.
 */
export class SseParser {
  private buffer = ''

  push(chunk: string): RunnerEvent[] {
    this.buffer += chunk.replace(/\r\n/g, '\n')
    const events: RunnerEvent[] = []
    let index: number
    while ((index = this.buffer.indexOf('\n\n')) >= 0) {
      const block = this.buffer.slice(0, index)
      this.buffer = this.buffer.slice(index + 2)
      const data = block.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n')
      const event = data ? parseRunnerEvent(data) : undefined
      if (event) events.push(event)
    }
    return events
  }
}
