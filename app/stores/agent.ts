import type { RunnerEvent } from '../../shared/agent/events'
import type { AgentConfig, QueueItem, QueueStatus } from '../../shared/agent/model'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { sanitizeAgentState } from '../../shared/agent/model'
import { enqueue, moveQueued, nextQueued, removeItem, transition } from '../../shared/agent/queue'

const KEY = 'redmine-client:agent'
const LOG_LIMIT = 300

/**
 * Cola de Agente (F11-T04): configuración no secreta (rama base, mapeo de estados)
 * y la cola, en `localStorage`. La URL y el token del runner son los de la IA
 * (`stores/ai.ts`): el token nunca se guarda. El log de cada tarea vive en memoria.
 */
export const useAgentStore = defineStore('agent', () => {
  let initial = sanitizeAgentState(null)
  try {
    initial = sanitizeAgentState(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  }
  catch {
    // Sin almacenamiento: cola vacía.
  }

  const config = ref<AgentConfig>(initial.config)
  const queue = ref<QueueItem[]>(initial.queue)
  /** La cola avanza sola salvo que se pause. */
  const paused = ref(false)
  const logs = ref<Record<string, string[]>>({})
  /** Último evento visto del runner, para reanudar el SSE sin repetir. */
  const lastEventId = ref(0)

  watch([config, queue], () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ config: config.value, queue: queue.value }))
    }
    catch {
      // Ver arriba.
    }
  }, { deep: true })

  const next = computed(() => nextQueued(queue.value))
  const running = computed(() => queue.value.find(i => i.status === 'working' || i.status === 'testing'))

  function add(issue: { id: number, title: string }): boolean {
    const before = queue.value.length
    queue.value = enqueue(queue.value, issue, () => crypto.randomUUID(), Date.now())
    return queue.value.length > before
  }

  function move(id: string, toIndex: number): void {
    queue.value = moveQueued(queue.value, id, toIndex)
  }

  function remove(id: string): void {
    queue.value = removeItem(queue.value, id)
  }

  function setStatus(id: string, to: QueueStatus, patch: Partial<Pick<QueueItem, 'branch' | 'prUrl' | 'reason'>> = {}): QueueItem | undefined {
    const before = queue.value.find(i => i.id === id)?.status
    queue.value = transition(queue.value, id, to, patch)
    const after = queue.value.find(i => i.id === id)
    return after && after.status !== before ? after : undefined
  }

  function appendLog(id: string, line: string): void {
    const lines = [...(logs.value[id] ?? []), line]
    logs.value = { ...logs.value, [id]: lines.slice(-LOG_LIMIT) }
  }

  /** Un evento del runner → cambio de fase (si es válido) y/o línea de log. Devuelve la tarea si cambió de fase. */
  function applyEvent(event: RunnerEvent): QueueItem | undefined {
    lastEventId.value = Math.max(lastEventId.value, event.id)
    if (event.line) appendLog(event.taskId, event.line)
    if (event.type !== 'phase' || !event.phase) {
      if (event.branch) queue.value = queue.value.map(i => i.id === event.taskId ? { ...i, branch: event.branch } : i)
      return undefined
    }
    if (event.reason) appendLog(event.taskId, event.reason)
    return setStatus(event.taskId, event.phase, { branch: event.branch, prUrl: event.prUrl, reason: event.reason })
  }

  return { config, queue, paused, logs, lastEventId, next, running, add, move, remove, setStatus, appendLog, applyEvent }
})
