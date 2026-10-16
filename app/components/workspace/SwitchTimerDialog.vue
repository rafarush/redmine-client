<script setup lang="ts">
import { elapsedHours, formatDuration, roundHours } from '../../../shared/time/duration'

/**
 * Solo hay un cronómetro (F4-T05). Arrancar otra tarea con uno en marcha pregunta
 * qué hacer con el tiempo medido, en vez de perderlo en silencio.
 */
const flow = useCardFlow()
const workspace = useWorkspaceStore()

const next = computed(() => flow.pendingSwitch.value)
const open = computed({
  get: () => next.value !== null,
  set: (value: boolean) => {
    if (!value) flow.pendingSwitch.value = null
  },
})

const elapsed = computed(() => {
  const timer = workspace.activeTimer
  return timer ? formatDuration(roundHours(elapsedHours(timer.startedAt, Date.now()))) : ''
})

/** Para el actual sin tocar su estado ni registrar nada, y arranca el nuevo. */
async function discardAndSwitch(): Promise<void> {
  const issue = next.value
  if (!issue) return
  if (workspace.activeTimer) workspace.stopTimer(workspace.activeTimer.issueId)
  flow.pendingSwitch.value = null
  await flow.start(issue, true)
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Ya hay un cronómetro en marcha"
    :description="workspace.activeTimer ? `#${workspace.activeTimer.issueId} lleva ${elapsed}. Solo puede haber uno.` : undefined"
    :width="26"
  >
    <p class="text-secondary">
      Para registrar ese tiempo, completa antes #{{ workspace.activeTimer?.issueId }} con doble clic.
    </p>
    <template #footer>
      <UiButton
        label="Cancelar"
        variant="ghost"
        @click="open = false"
      />
      <UiButton
        :label="next ? `Descartar y empezar #${next.id}` : 'Descartar y empezar'"
        variant="primary"
        @click="discardAndSwitch"
      />
    </template>
  </UiDialog>
</template>
