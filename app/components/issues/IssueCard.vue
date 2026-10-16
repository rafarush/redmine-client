<script setup lang="ts">
import type { Issue } from '../../../shared/redmine/types'
import { PRIORITY_ICON, priorityLevel } from '../../../shared/redmine/issue-display'
import { formatClock, formatDuration } from '../../../shared/time/duration'
import { describeDue } from '../../../shared/workspace/due'
import { elapsedMs, timerFor } from '../../../shared/workspace/flow'

/**
 * Una tarea en el panel del workspace (F2c-T06) o en el kanban (F2d).
 *
 * - Clic o Intro: abre el detalle de la tarea.
 * - Doble clic o Espacio: avanza el flujo (pendiente → en curso → completada).
 * - Clic derecho, tecla Menú o Mayús+F10: menú contextual de la tarea.
 * - En curso: ⏸/▶ pausa o reanuda el cronómetro (P) y ⏹ registra lo medido (S).
 * - ▲▼ o Alt+↑/↓: sube o baja la prioridad.
 * - Completada: botón RTQA y cronómetro para ajustar el tiempo (también con T).
 *
 * `row` es la fila del panel de salidas (columnas fijas); `tile`, la tarjeta del kanban.
 */
const props = withDefaults(defineProps<{
  issue: Issue
  variant?: 'row' | 'tile'
  /** Fila alterna del panel (relleno suave). */
  alternate?: boolean
}>(), { variant: 'row' })

const session = useSessionStore()
const workspace = useWorkspaceStore()
const flow = useCardFlow()
const menu = useIssueMenu()

/**
 * Un clic abre el detalle, pero un doble clic avanza el flujo: el clic espera lo
 * justo para saber si llega el segundo. El retraso es el del doble clic del sistema
 * aproximado; con teclado no hay espera (Intro abre, Espacio avanza).
 */
const DOUBLE_CLICK_MS = 260
let pendingClick: ReturnType<typeof setTimeout> | undefined
function onClick(event: MouseEvent): void {
  if (event.detail > 1) return
  clearTimeout(pendingClick)
  pendingClick = setTimeout(() => flow.openDetails(props.issue), DOUBLE_CLICK_MS)
}
function onDoubleClick(): void {
  clearTimeout(pendingClick)
  flow.onDoubleClick(props.issue)
}
onBeforeUnmount(() => clearTimeout(pendingClick))

const stage = computed(() => flow.stage(props.issue))
const timer = computed(() => timerFor(workspace.timers, props.issue.id))
const logged = computed(() => workspace.loggedFor(props.issue.id))
const moved = computed(() => flow.recentlyMoved.value[props.issue.id])
const due = computed(() => describeDue(props.issue.due_date, today()))

const priorityIcon = computed(() => {
  const list = session.catalogs.priorities
  const position = list.findIndex(p => p.id === props.issue.priority.id)
  const defaultPosition = Math.max(0, list.findIndex(p => p.is_default))
  return PRIORITY_ICON[position < 0 ? 'normal' : priorityLevel(position, defaultPosition)]
})
const urgent = computed(() => priorityIcon.value === PRIORITY_ICON.urgent)

// El cronómetro solo hace tic en la card cuyo cronómetro corre.
const now = ref(Date.now())
let tick: ReturnType<typeof setInterval> | undefined
watch(() => timer.value && !timer.value.paused, (running) => {
  clearInterval(tick)
  now.value = Date.now()
  if (running) {
    now.value = Date.now()
    tick = setInterval(() => {
      now.value = Date.now()
    }, 1000)
  }
}, { immediate: true })
onBeforeUnmount(() => clearInterval(tick))

const clock = computed(() => timer.value ? formatClock(elapsedMs(timer.value, now.value)) : '')
const paused = computed(() => !!timer.value?.paused)

const STAGE_ICON = {
  idle: 'lucide:circle-dashed',
  in_progress: 'lucide:timer',
  done: 'lucide:circle-check',
  rtqa: 'lucide:flask-conical',
} as const

const DUE_CLASS = {
  overdue: 'font-semibold text-warning',
  today: 'font-semibold text-content',
  soon: 'text-content',
  later: 'text-secondary',
  none: 'text-tertiary',
} as const

/** Lo que oye un lector de pantalla al llegar a la fila. */
const description = computed(() => {
  const parts = [`#${props.issue.id} ${props.issue.subject}`, `prioridad ${props.issue.priority.name}`, `vence ${due.value.label}`, props.issue.status.name]
  if (clock.value) parts.push(`${paused.value ? 'cronómetro en pausa' : 'cronómetro'} ${clock.value}`)
  return parts.join(', ')
})

function onKeydown(event: KeyboardEvent): void {
  if (event.target !== event.currentTarget) return
  if (menu.handleKey(props.issue, event)) return
  if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault()
    void flow.bumpPriority(props.issue, event.key === 'ArrowUp' ? 'up' : 'down')
  }
  else if (event.key === 'Enter') {
    event.preventDefault()
    flow.openDetails(props.issue)
  }
  else if (event.key === ' ') {
    event.preventDefault()
    flow.onDoubleClick(props.issue)
  }
  else if (event.metaKey || event.ctrlKey || event.altKey) {
    // Atajos del navegador y del sistema: no son de la card.
  }
  else if (event.key.toLowerCase() === 't') {
    event.preventDefault()
    flow.adjusting.value = props.issue
  }
  else if (event.key.toLowerCase() === 'p' && timer.value) {
    event.preventDefault()
    flow.togglePause(props.issue)
  }
  else if (event.key.toLowerCase() === 's' && timer.value) {
    event.preventDefault()
    void flow.stop(props.issue)
  }
}
</script>

<template>
  <li
    tabindex="0"
    :aria-label="description"
    aria-keyshortcuts="Enter Space Alt+ArrowUp Alt+ArrowDown T P S Shift+F10"
    aria-haspopup="menu"
    :data-issue="issue.id"
    :data-stage="stage"
    class="group relative cursor-pointer select-none outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
    :class="[
      variant === 'row'
        ? 'board-row grid min-h-[var(--row-height)] items-center pr-2 text-[length:var(--text-body)]'
        : 'kanban-tile grid gap-x-2 gap-y-1.5 rounded-[var(--radius-control)] border border-separator bg-raised p-3 text-[length:var(--text-body)] shadow-panel',
      moved ? 'bg-change' : variant === 'row' && alternate ? 'bg-fill-alt hover:bg-fill-hover' : 'hover:bg-fill-hover',
    ]"
    @click="onClick"
    @dblclick="onDoubleClick"
    @contextmenu.prevent="menu.open(issue, $event.clientX, $event.clientY)"
    @keydown="onKeydown"
  >
    <!-- # -->
    <span
      class="card-id data text-[length:var(--text-caption)] text-secondary"
      :class="variant === 'row' ? 'pl-4' : ''"
    >{{ issue.id }}</span>

    <!-- Tarea -->
    <span
      class="card-subject min-w-0"
      :class="[
        stage === 'in_progress' ? 'font-semibold text-content' : stage === 'done' || stage === 'rtqa' ? 'text-secondary' : 'text-content',
        variant === 'row' ? 'truncate pr-3' : 'line-clamp-3 font-medium',
      ]"
      :title="issue.subject"
    >{{ issue.subject }}</span>

    <!-- Vence -->
    <span
      class="card-due data text-[length:var(--text-caption)]"
      :class="DUE_CLASS[due.tone]"
    >
      <span
        v-if="variant === 'tile'"
        class="text-secondary"
      >Vence </span>{{ due.label }}
    </span>

    <!-- Prioridad -->
    <span
      class="card-priority board-priority flex min-w-0 flex-col justify-center text-[length:var(--text-caption)]"
      :class="urgent ? 'font-semibold text-content' : 'text-secondary'"
    >
      <span class="inline-flex items-center gap-1">
        <Icon
          :name="priorityIcon"
          class="size-3.5 shrink-0"
          aria-hidden="true"
        />
        <span class="truncate">{{ issue.priority.name }}</span>
      </span>
      <span
        v-if="moved"
        class="mt-0.5 self-start rounded-[var(--radius-plate)] px-1 text-[10px] font-semibold leading-4 text-on-change"
      >{{ moved === 'up' ? 'Subida' : 'Bajada' }} · ahora</span>
    </span>

    <!-- Estado -->
    <span
      class="card-status flex min-w-0 items-center gap-1.5 text-[length:var(--text-caption)]"
      :class="stage === 'in_progress' ? 'font-semibold text-content' : stage === 'done' ? 'text-success' : 'text-secondary'"
    >
      <Icon
        :name="paused ? 'lucide:pause' : STAGE_ICON[stage]"
        class="size-3.5 shrink-0"
        aria-hidden="true"
      />
      <span class="truncate">
        <template v-if="stage === 'in_progress' && clock">{{ paused ? 'En pausa' : 'En curso' }} <span class="data font-medium">{{ clock }}</span></template>
        <template v-else-if="stage === 'done' && logged">Completada · <span class="data">{{ formatDuration(logged.hours) }}</span></template>
        <template v-else>{{ issue.status.name }}</template>
      </span>
    </span>

    <!-- Acciones -->
    <span class="card-actions flex items-center justify-end gap-1">
      <template v-if="stage === 'done' || stage === 'rtqa'">
        <Can
          v-if="stage === 'done'"
          permission="edit_issues"
          :project="issue.project.id"
        >
          <button
            type="button"
            class="h-6 rounded-[var(--radius-plate)] bg-accent px-2 text-[10px] font-bold uppercase tracking-[0.04em] text-on-accent hover:brightness-110"
            :aria-label="`Pasar #${issue.id} a RTQA`"
            @click.stop="flow.rtqa(issue)"
            @dblclick.stop
          >
            RTQA
          </button>
        </Can>
        <Can
          permission="log_time"
          :project="issue.project.id"
        >
          <UiButton
            :label="`Ajustar el tiempo de #${issue.id}`"
            icon="lucide:timer-reset"
            icon-only
            variant="ghost"
            shortcut="T"
            tabindex="-1"
            class="!min-h-7 !min-w-7"
            @click.stop="flow.adjusting.value = issue"
            @dblclick.stop
          />
        </Can>
      </template>

      <template v-else>
        <!-- Cronómetro en marcha o en pausa: un botón que alterna ⏸/▶ y ⏹ para registrar. -->
        <span
          v-if="timer"
          class="flex items-center"
          @dblclick.stop
        >
          <button
            type="button"
            tabindex="-1"
            class="grid size-7 place-items-center rounded-[var(--radius-plate)] text-content hover:bg-fill-selected"
            :aria-label="paused ? `Reanudar el cronómetro de #${issue.id}` : `Pausar el cronómetro de #${issue.id}`"
            :title="paused ? 'Reanudar (P)' : 'Pausar (P)'"
            @click.stop="flow.togglePause(issue)"
          >
            <Icon
              :name="paused ? 'lucide:play' : 'lucide:pause'"
              class="size-4"
              aria-hidden="true"
            />
          </button>
          <Can
            permission="log_time"
            :project="issue.project.id"
          >
            <button
              type="button"
              tabindex="-1"
              class="grid size-7 place-items-center rounded-[var(--radius-plate)] text-content hover:bg-fill-selected"
              :aria-label="`Parar y registrar el tiempo de #${issue.id}`"
              title="Parar y registrar (S)"
              @click.stop="flow.stop(issue)"
            >
              <Icon
                name="lucide:square"
                class="size-3.5 fill-current"
                aria-hidden="true"
              />
            </button>
          </Can>
        </span>
        <Can
          permission="edit_issues"
          :project="issue.project.id"
        >
          <span
            class="flex flex-col"
            @dblclick.stop
          >
            <button
              type="button"
              tabindex="-1"
              class="grid h-[18px] w-6 place-items-center rounded-t-[var(--radius-plate)] text-tertiary hover:bg-fill-selected hover:text-content disabled:opacity-30"
              :aria-label="`Subir la prioridad de #${issue.id}`"
              :disabled="!flow.canBump(issue, 'up')"
              @click.stop="flow.bumpPriority(issue, 'up')"
            >
              <Icon
                name="lucide:chevron-up"
                class="size-3.5"
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              tabindex="-1"
              class="grid h-[18px] w-6 place-items-center rounded-b-[var(--radius-plate)] text-tertiary hover:bg-fill-selected hover:text-content disabled:opacity-30"
              :aria-label="`Bajar la prioridad de #${issue.id}`"
              :disabled="!flow.canBump(issue, 'down')"
              @click.stop="flow.bumpPriority(issue, 'down')"
            >
              <Icon
                name="lucide:chevron-down"
                class="size-3.5"
                aria-hidden="true"
              />
            </button>
          </span>
        </Can>
      </template>
    </span>
  </li>
</template>
