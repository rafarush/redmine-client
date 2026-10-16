<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { formatClock, formatDuration } from '../../../shared/time/duration'
import { elapsedMs } from '../../../shared/workspace/flow'

/**
 * Franja de salidas (F2c): qué me toca hoy de un vistazo. Fecha, la tarea en curso
 * con su cronómetro, pendientes, las que vencen hoy y lo registrado hoy. Es dato
 * vivo, no adorno: el cronómetro lleva a su tarea.
 */
const redmine = useRedmine()
const workspace = useWorkspaceStore()

const day = today()

// Forma `{ pages }` como la lista: `useIssueChange` parchea todas las consultas `['issues']`.
const mine = useQuery({
  queryKey: ['issues', 'mine-summary'],
  queryFn: async () => ({ pages: [await redmine.listIssues({ assigned_to_id: 'me', status_id: 'open', limit: 100 })] }),
})
const page = computed(() => mine.data.value?.pages[0])
const pending = computed(() => page.value?.totalCount)
/** Vencen hoy o ya vencieron: lo que hay que sacar hoy. */
const dueToday = computed(() => page.value?.items.filter(issue => issue.due_date && issue.due_date <= day).length)

const logged = useQuery({
  queryKey: ['time-entries', 'today', day],
  queryFn: () => redmine.listTimeEntries({ user_id: 'me', from: day, to: day }),
})
const loggedHours = computed(() => logged.data.value?.items.reduce((sum, entry) => sum + entry.hours, 0))

const dateLabel = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short' })
  .formatToParts(new Date())
  .reduce<{ weekday: string, date: string }>((acc, part) => {
    if (part.type === 'weekday') acc.weekday = part.value.replace('.', '')
    else if (part.type === 'day' || part.type === 'month') acc.date += `${acc.date ? ' ' : ''}${part.value.replace('.', '')}`
    return acc
  }, { weekday: '', date: '' })

const now = ref(Date.now())
let tick: ReturnType<typeof setInterval> | undefined
watch(() => workspace.activeTimer && !workspace.activeTimer.paused, (running) => {
  clearInterval(tick)
  now.value = Date.now()
  if (running) tick = setInterval(() => {
    now.value = Date.now()
  }, 1000)
}, { immediate: true })
onBeforeUnmount(() => clearInterval(tick))

function focusActive(): void {
  const id = workspace.activeTimer?.issueId
  if (!id) return
  const row = document.querySelector<HTMLElement>(`[data-issue="${id}"]`)
  row?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  row?.focus({ preventScroll: true })
}

const ITEM = 'flex shrink-0 items-center gap-2 border-l border-board-separator px-4 first:border-l-0'
</script>

<template>
  <section
    aria-label="Resumen de hoy"
    class="mx-3 flex min-h-12 items-center overflow-x-auto rounded-[var(--radius-surface)] bg-board px-1 text-on-board shadow-popover wide:mx-6"
  >
    <div :class="ITEM">
      <span class="panel-label !text-on-board-secondary">{{ dateLabel.weekday }}</span>
      <span class="data text-[length:var(--text-title)] font-semibold uppercase">{{ dateLabel.date }}</span>
    </div>

    <button
      v-if="workspace.activeTimer"
      type="button"
      :class="[ITEM, 'min-h-10 rounded-[var(--radius-control)] hover:bg-board-separator']"
      :aria-label="`${workspace.activeTimer.paused ? 'En pausa' : 'En curso'}: tarea ${workspace.activeTimer.issueId}, ${formatClock(elapsedMs(workspace.activeTimer, now))}. Ir a la tarea`"
      @click="focusActive"
    >
      <span class="panel-label !text-on-board-secondary">{{ workspace.activeTimer.paused ? 'En pausa' : 'En curso' }}</span>
      <span class="data text-on-board-secondary">#{{ workspace.activeTimer.issueId }}</span>
      <span class="data text-[length:var(--text-title)] font-semibold">{{ formatClock(elapsedMs(workspace.activeTimer, now)) }}</span>
    </button>
    <div
      v-else
      :class="ITEM"
    >
      <span class="panel-label !text-on-board-secondary">En curso</span>
      <span class="text-on-board-secondary">Nada. Doble clic en una tarea para empezar</span>
    </div>

    <div :class="ITEM">
      <span class="panel-label !text-on-board-secondary">Pendientes</span>
      <span class="data text-[length:var(--text-title)] font-semibold">{{ pending ?? '—' }}</span>
    </div>
    <div :class="ITEM">
      <span class="panel-label !text-on-board-secondary">Para hoy</span>
      <span class="data text-[length:var(--text-title)] font-semibold">{{ dueToday ?? '—' }}</span>
    </div>
    <div :class="ITEM">
      <span class="panel-label !text-on-board-secondary">Registrado hoy</span>
      <span class="data text-[length:var(--text-title)] font-semibold">{{ loggedHours === undefined ? '—' : loggedHours === 0 ? '0 min' : formatDuration(loggedHours) }}</span>
    </div>
  </section>
</template>
