<script setup lang="ts">
import type { RunnerEvent } from '../../../shared/agent/events'

/**
 * Motor de la Cola de Agente (F11-T04), sin interfaz y una sola vez en el layout:
 * mantiene el SSE del runner (reconecta con Last-Event-ID), pasa cada evento al
 * store y, cuando no hay nada en curso, manda la siguiente tarea al runner.
 */
const queue = useAgentQueue()
const { store, runner, connected } = queue
const redmine = useRedmine()
const toasts = useToastStore()

let controller: AbortController | undefined
let retryTimer: ReturnType<typeof setTimeout> | undefined
const RETRY_MS = 4_000

function onEvent(event: RunnerEvent): void {
  const changed = store.applyEvent(event)
  if (changed) void queue.applyStatus(changed, changed.status)
}

async function connect(): Promise<void> {
  clearTimeout(retryTimer)
  controller?.abort()
  if (!runner.configured.value) {
    connected.value = false
    return
  }
  controller = new AbortController()
  const own = controller
  try {
    // Al conectar se pregunta si el runner sigue con algo: si no, lo "en curso" quedó huérfano.
    const health = await runner.health()
    if (!health.busy && store.running) store.setStatus(store.running.id, 'blocked', { reason: 'El runner no la tiene en curso (¿se reinició?)' })
    connected.value = true
    await runner.listen(store.lastEventId, onEvent, own.signal)
  }
  catch {
    // Sin runner o conexión cortada: se reintenta en silencio.
  }
  if (own !== controller) return
  connected.value = false
  retryTimer = setTimeout(connect, RETRY_MS)
}

/** Siguiente tarea: la descripción y los comentarios salen de Redmine en ese momento. */
let starting = false
async function startNext(): Promise<void> {
  const item = store.next
  if (starting || !item || store.running || store.paused || !connected.value) return
  starting = true
  try {
    const issue = await redmine.getIssue(item.issueId, 'journals')
    const comments = (issue.journals ?? []).flatMap(j => j.notes?.trim() && !j.private_notes ? [j.notes.trim().slice(0, 5_000)] : []).slice(-20)
    const accepted = await runner.start({
      id: item.id,
      issueId: issue.id,
      title: issue.subject.slice(0, 255),
      description: (issue.description ?? '').slice(0, 20_000),
      comments,
      baseBranch: store.config.baseBranch,
    })
    if (accepted) {
      const changed = store.setStatus(item.id, 'working')
      if (changed) void queue.applyStatus(changed, 'working')
    }
  }
  catch (error) {
    store.paused = true
    toasts.show(`La cola se ha pausado: ${(error as Error).message}`)
  }
  finally {
    starting = false
  }
}

watch(() => [runner.configured.value, useAiStore().runnerUrl], () => void connect(), { immediate: true })
watch(() => [store.next?.id, store.running?.id, store.paused, connected.value], () => void startNext())

onBeforeUnmount(() => {
  clearTimeout(retryTimer)
  controller?.abort()
})
</script>

<template>
  <span class="hidden" />
</template>
