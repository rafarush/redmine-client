import type { QueueItem, QueueStatus } from './model'

/** Transiciones válidas de la cola. `pr_opened` y `cancelled` son finales; solo se reintenta lo bloqueado. */
const TRANSITIONS: Record<QueueStatus, readonly QueueStatus[]> = {
  queued: ['working', 'cancelled'],
  working: ['testing', 'blocked', 'cancelled'],
  testing: ['pr_opened', 'blocked', 'cancelled'],
  pr_opened: [],
  blocked: ['queued', 'cancelled'],
  cancelled: ['queued'],
}

export const ACTIVE_STATUSES: readonly QueueStatus[] = ['working', 'testing']

export function canTransition(from: QueueStatus, to: QueueStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/** Añade una tarea al final; una misma issue no puede estar dos veces pendiente o en curso. */
export function enqueue(
  queue: readonly QueueItem[],
  issue: { id: number, title: string },
  makeId: () => string,
  now: number,
): QueueItem[] {
  const open = queue.some(i => i.issueId === issue.id && (i.status === 'queued' || ACTIVE_STATUSES.includes(i.status)))
  if (open) return [...queue]
  return [...queue, { id: makeId(), issueId: issue.id, title: issue.title, status: 'queued', addedAt: now }]
}

/** Cambia la fase de una tarea si la transición es válida; si no, devuelve la cola sin tocar. */
export function transition(
  queue: readonly QueueItem[],
  id: string,
  to: QueueStatus,
  patch: Partial<Pick<QueueItem, 'branch' | 'prUrl' | 'reason'>> = {},
): QueueItem[] {
  return queue.map((item) => {
    if (item.id !== id || !canTransition(item.status, to)) return item
    // Al reintentar se limpia el motivo del fallo anterior.
    return { ...item, ...patch, status: to, reason: patch.reason ?? (to === 'queued' ? undefined : item.reason) }
  })
}

/** Siguiente tarea a ejecutar: ninguna si ya hay una en curso (la cola es secuencial). */
export function nextQueued(queue: readonly QueueItem[]): QueueItem | undefined {
  if (queue.some(i => ACTIVE_STATUSES.includes(i.status))) return undefined
  return queue.find(i => i.status === 'queued')
}

export function removeItem(queue: readonly QueueItem[], id: string): QueueItem[] {
  return queue.filter(i => i.id !== id || ACTIVE_STATUSES.includes(i.status))
}

/** Mueve una tarea pendiente; las que ya empezaron mantienen su sitio. */
export function moveQueued(queue: readonly QueueItem[], id: string, toIndex: number): QueueItem[] {
  const from = queue.findIndex(i => i.id === id)
  if (from < 0 || queue[from]!.status !== 'queued') return [...queue]
  const items = [...queue]
  const [moved] = items.splice(from, 1)
  items.splice(Math.min(Math.max(toIndex, 0), items.length), 0, moved!)
  return items
}
