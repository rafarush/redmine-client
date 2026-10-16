<script setup lang="ts">
import type { Issue, Paginated } from '../../../shared/redmine/types'
import { useQuery } from '@tanstack/vue-query'
import { PRIORITY_ICON, priorityLevel, projectCode } from '../../../shared/redmine/issue-display'
import { formatClock } from '../../../shared/time/duration'
import { elapsedMs, timerFor } from '../../../shared/workspace/flow'

/**
 * Detalle de una tarea (F3-T01, primera versión): cabecera, cronómetro y acciones
 * del flujo, descripción (F3-T03), adjuntos (F3-T06), vínculos (F3-T05), historial
 * con comentarios (F3-T04) y datos editables campo a campo (F3-T02). El menú "…" es
 * el mismo del clic derecho.
 *
 * La consulta usa la clave `['issues', 'detail', id]` con forma `{ pages }`, así los
 * cambios optimistas de `useIssueChange` también se ven aquí.
 */
definePageMeta({ title: 'Tarea' })

const route = useRoute()
const router = useRouter()
const redmine = useRedmine()
const session = useSessionStore()
const workspace = useWorkspaceStore()
const flow = useCardFlow()
const menu = useIssueMenu()

const id = computed(() => Number(route.params.id))

const query = useQuery({
  queryKey: computed(() => ['issues', 'detail', id.value]),
  queryFn: async (): Promise<{ pages: Paginated<Issue>[] }> => {
    const issue = await redmine.getIssue(id.value, 'journals,allowed_statuses,attachments,relations,children,watchers')
    return { pages: [{ items: [issue], totalCount: 1, offset: 0, limit: 1 }] }
  },
  enabled: computed(() => Number.isInteger(id.value) && id.value > 0),
})
const issue = computed(() => query.data.value?.pages[0]?.items[0])

const pageTitle = useState<string | null>('page-title')
watchEffect(() => {
  pageTitle.value = issue.value ? issue.value.subject : null
})
onBeforeUnmount(() => {
  pageTitle.value = null
})

const stage = computed(() => issue.value ? flow.stage(issue.value) : 'idle')
const timer = computed(() => issue.value ? timerFor(workspace.timers, issue.value.id) : undefined)
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

const clock = computed(() => timer.value ? formatClock(elapsedMs(timer.value, now.value)) : null)

const priorityIcon = computed(() => {
  const list = session.catalogs.priorities
  const position = list.findIndex(p => p.id === issue.value?.priority.id)
  const defaultPosition = Math.max(0, list.findIndex(p => p.is_default))
  return PRIORITY_ICON[position < 0 ? 'normal' : priorityLevel(position, defaultPosition)]
})

function openInRedmine(): void {
  window.open(`${session.url.replace(/\/$/, '')}/issues/${id.value}`, '_blank', 'noopener')
}

function goBack(): void {
  if (window.history.state?.back) router.back()
  else void navigateTo('/')
}

const STAGE_LABEL = { idle: 'Pendiente', in_progress: 'En curso', done: 'Completada', rtqa: 'RTQA' } as const
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 px-3 pb-6 wide:px-6">
    <Teleport
      defer
      to="#toolbar-actions"
    >
      <UiButton
        label="Volver"
        icon="lucide:arrow-left"
        icon-only
        variant="ghost"
        @click="goBack"
      />
      <UiButton
        v-if="issue"
        :label="`Acciones de la tarea #${issue.id}`"
        icon="lucide:ellipsis"
        icon-only
        variant="ghost"
        aria-haspopup="menu"
        @click="menu.openAt(issue, $event.currentTarget as Element)"
      />
      <UiButton
        label="Abrir en Redmine"
        icon="lucide:external-link"
        icon-only
        variant="ghost"
        @click="openInRedmine"
      />
    </Teleport>

    <div
      v-if="query.isPending.value"
      class="flex flex-col gap-3"
      aria-busy="true"
      aria-label="Cargando la tarea"
    >
      <div class="h-6 w-72 rounded-[var(--radius-plate)] bg-fill-selected motion-safe:animate-pulse" />
      <div class="h-40 rounded-[var(--radius-surface)] bg-fill-selected motion-safe:animate-pulse" />
    </div>

    <div
      v-else-if="query.error.value || !issue"
      role="alert"
      class="flex flex-col items-center gap-3 py-16 text-center"
    >
      <Icon
        name="lucide:file-question"
        class="size-8 text-tertiary"
        aria-hidden="true"
      />
      <p class="text-secondary">
        No se pudo abrir la tarea #{{ id }}. Puede que no exista o que no tengas acceso.
      </p>
      <UiButton
        label="Reintentar"
        icon="lucide:rotate-cw"
        @click="query.refetch()"
      />
    </div>

    <template v-else>
      <!-- Identidad: proyecto, tipo, número, estado y prioridad. -->
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--text-caption)] text-secondary">
        <span class="inline-flex items-center gap-1.5">
          <UiPlate
            :name="issue.project.name"
            :code="projectCode(issue.project.name)"
          />
          <span class="text-content">{{ issue.project.name }}</span>
          <span aria-hidden="true">›</span>
          {{ issue.tracker.name }}
        </span>
        <span class="data">#{{ issue.id }}</span>
        <span class="inline-flex items-center gap-1 font-semibold text-content">
          <Icon
            name="lucide:circle-dot"
            class="size-3.5"
            aria-hidden="true"
          />
          {{ issue.status.name }}
        </span>
        <span class="inline-flex items-center gap-1">
          <Icon
            :name="priorityIcon"
            class="size-3.5"
            aria-hidden="true"
          />
          {{ issue.priority.name }}
        </span>
      </div>

      <!-- Cronómetro y flujo: la franja de salidas de esta tarea. -->
      <section
        aria-label="Cronómetro y flujo"
        class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-surface)] bg-board px-4 py-2.5 text-on-board shadow-popover"
      >
        <div class="flex items-baseline gap-2">
          <span class="panel-label !text-on-board-secondary">{{ timer?.paused ? 'En pausa' : STAGE_LABEL[stage] }}</span>
          <span
            v-if="clock"
            class="data text-[length:var(--text-title)] font-semibold"
          >{{ clock }}</span>
        </div>

        <Can
          permission="log_time"
          :project="issue.project.id"
        >
          <div class="ml-auto flex flex-wrap items-center gap-2">
            <UiButton
              v-if="stage === 'idle' || stage === 'in_progress'"
              :label="!timer ? 'Iniciar' : timer.paused ? 'Reanudar' : 'Pausar'"
              :icon="!timer || timer.paused ? 'lucide:play' : 'lucide:pause'"
              :variant="!timer ? 'primary' : 'secondary'"
              @click="flow.toggleTimer(issue)"
            />
            <UiButton
              v-if="timer"
              label="Parar y registrar"
              icon="lucide:square"
              @click="flow.stop(issue)"
            />
            <UiButton
              v-if="stage === 'in_progress'"
              label="Completar"
              icon="lucide:circle-check"
              @click="flow.complete(issue)"
            />
            <UiButton
              v-if="stage === 'done'"
              label="Pasar a RTQA"
              icon="lucide:flask-conical"
              variant="primary"
              @click="flow.rtqa(issue)"
            />
            <UiButton
              label="Registrar tiempo…"
              icon="lucide:clock-plus"
              @click="flow.logging.value = issue"
            />
          </div>
        </Can>
      </section>

      <div class="grid items-start gap-4 wide:grid-cols-[minmax(0,1fr)_20rem]">
        <div class="flex min-w-0 flex-col gap-4">
          <IssuesIssueDescription :issue="issue" />

          <IssuesIssueAttachments :issue="issue" />

          <IssuesIssueLinks :issue="issue" />

          <IssuesIssueHistory :issue="issue" />
        </div>

        <IssuesIssueFields :issue="issue" />
      </div>
    </template>
  </div>
</template>
