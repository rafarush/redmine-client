<script setup lang="ts">
import { formatClock } from '../../../shared/time/duration'
import { elapsedMs } from '../../../shared/workspace/flow'

/**
 * Cronómetro activo en la toolbar (F4-T08): "#4821 · 00:32:10" en cualquier
 * pantalla, y lleva a la tarea. En el workspace no hace falta: ya lo enseña la
 * franja de salidas. Solo lee el store del workspace.
 */
const workspace = useWorkspaceStore()
const route = useRoute()

const timer = computed(() => workspace.activeTimer)
const visible = computed(() => !!timer.value && route.path !== '/')

const now = ref(Date.now())
let tick: ReturnType<typeof setInterval> | undefined
watch(() => timer.value && !timer.value.paused, (running) => {
  clearInterval(tick)
  now.value = Date.now()
  if (running) {
    tick = setInterval(() => {
      now.value = Date.now()
    }, 1000)
  }
}, { immediate: true })
onBeforeUnmount(() => clearInterval(tick))

const clock = computed(() => timer.value ? formatClock(elapsedMs(timer.value, now.value)) : '')
</script>

<template>
  <NuxtLink
    v-if="visible && timer"
    :to="`/issues/${timer.issueId}`"
    class="inline-flex min-h-[var(--control-min)] shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] bg-board px-2.5 text-on-board shadow-popover hover:brightness-110"
    :aria-label="`${timer.paused ? 'Cronómetro en pausa' : 'Cronómetro en marcha'}: tarea ${timer.issueId}, ${clock}. Ir a la tarea`"
  >
    <Icon
      :name="timer.paused ? 'lucide:pause' : 'lucide:timer'"
      class="size-4"
      aria-hidden="true"
    />
    <span class="data text-[length:var(--text-caption)] text-on-board-secondary">#{{ timer.issueId }}</span>
    <span class="data hidden font-semibold wide:inline">{{ clock }}</span>
  </NuxtLink>
</template>
