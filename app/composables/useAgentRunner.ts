import type { RunnerEvent, TaskRequest } from '../../shared/agent/events'
import { SseParser } from '../../shared/agent/events'
import { isLocalRunnerUrl } from '../../shared/agent/model'

/**
 * Conexión con el runner local (F11-T04): salud, encolar y cancelar por HTTP, y
 * los eventos por SSE leídos con `fetch` (EventSource no admite la cabecera del
 * token). La URL y el token son los de Ajustes › Inteligencia artificial.
 */
export class RunnerError extends Error {
  constructor(message: string, readonly status = 0) {
    super(message)
  }
}

export function useAgentRunner() {
  const ai = useAiStore()

  const base = computed(() => ai.runnerUrl.replace(/\/+$/, ''))
  /** Hay URL local y token: se puede intentar hablar con el runner. */
  const configured = computed(() => isLocalRunnerUrl(base.value) && !!ai.runnerToken)

  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    if (!configured.value) throw new RunnerError('Configura la URL y el token del runner en Ajustes › Inteligencia artificial.')
    let response: Response
    try {
      response = await fetch(`${base.value}${path}`, {
        ...init,
        headers: { 'authorization': `Bearer ${ai.runnerToken}`, 'content-type': 'application/json', ...init.headers },
      })
    }
    catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') throw error
      throw new RunnerError('No se pudo contactar con el runner. ¿Está arrancado (pnpm agent:runner)?')
    }
    if (response.status === 401) throw new RunnerError('El token del runner no es válido.', 401)
    return response
  }

  async function health(): Promise<{ ok: boolean, busy: boolean }> {
    const response = await call('/health')
    if (!response.ok) throw new RunnerError(`El runner respondió ${response.status}.`, response.status)
    return await response.json() as { ok: boolean, busy: boolean }
  }

  /** `false` si el runner ya está con otra tarea (409). */
  async function start(task: TaskRequest): Promise<boolean> {
    const response = await call('/tasks', { method: 'POST', body: JSON.stringify(task) })
    if (response.status === 409) return false
    if (!response.ok) throw new RunnerError(`El runner no aceptó la tarea (${response.status}).`, response.status)
    return true
  }

  async function cancel(id: string): Promise<void> {
    await call(`/tasks/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
  }

  /**
   * Escucha los eventos hasta que se aborte; si la conexión se corta, la cierra y
   * deja que quien llama reintente con `afterId` (Last-Event-ID).
   */
  async function listen(afterId: number, onEvent: (event: RunnerEvent) => void, signal: AbortSignal): Promise<void> {
    const response = await call('/events', { signal, headers: { 'last-event-id': String(afterId) } })
    if (!response.ok || !response.body) throw new RunnerError(`El runner respondió ${response.status}.`, response.status)
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
    const parser = new SseParser()
    for (;;) {
      const { value, done } = await reader.read()
      if (done) return
      for (const event of parser.push(value)) onEvent(event)
    }
  }

  return { configured, health, start, cancel, listen }
}
