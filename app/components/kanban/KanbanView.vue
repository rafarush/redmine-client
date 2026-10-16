<script setup lang="ts">
import type { IssueChange } from '../../../shared/redmine/issue-actions'
import type { Issue } from '../../../shared/redmine/types'
import type { KanbanMode, Lane } from '../../../shared/kanban/group'
import type { Board } from '../../../shared/workspace/model'
import { VueDraggable } from 'vue-draggable-plus'
import { matrix, sprintLanes, statusLanes } from '../../../shared/kanban/group'
import { applyChange } from '../../../shared/redmine/issue-actions'
import { boardProjectIds } from '../../../shared/workspace/model'
import { resolveStatusRank } from '../../../shared/workspace/sort'

/**
 * Kanban de un board (F2d-T03/T04). Mismas tareas que el board (mías y abiertas),
 * en columnas por estado, por sprint o en matriz sprint × estado. Arrastrar una
 * tarjeta cambia su estado o su sprint en Redmine; si el workflow no lo permite,
 * vuelve a su sitio y el aviso explica por qué. Con teclado: `[` y `]` mueven la
 * tarjeta enfocada a la columna anterior o siguiente.
 */
const props = defineProps<{
  board: Board
  mode: KanbanMode
}>()

const session = useSessionStore()
const workspace = useWorkspaceStore()
const { changeAsync } = useIssueChange()
const { issues, isPending, error, refetch } = useBoardIssues(() => props.board)

const projectIds = computed(() => {
  const ids = boardProjectIds(props.board, workspace.categories)
  return ids.length > 0 ? ids : [...new Set(issues.value.map(issue => issue.project.id))]
})
const { versions } = useBoardVersions(projectIds)

// Mismo orden de estados que en las listas de los boards (Ajustes → Boards).
const statuses = computed(() => {
  const rank = resolveStatusRank(session.catalogs.statuses, workspace.workspace.statusOrder)
  return [...session.catalogs.statuses].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
})

/** Una fila por sprint en la matriz; una sola fila sin título en los otros modos. */
const rows = computed<{ id: number | null, label: string | null, lanes: Lane<Issue>[] }[]>(() => {
  if (props.mode === 'matrix') {
    return matrix(issues.value, statuses.value, versions.value).map(row => ({ id: row.id, label: row.label, lanes: row.cells }))
  }
  const lanes = props.mode === 'sprint' ? sprintLanes(issues.value, versions.value) : statusLanes(issues.value, statuses.value)
  return [{ id: null, label: null, lanes }]
})

// Copias locales para Sortable: se rehacen cuando cambian los datos (también tras un cambio optimista).
const lists = ref<Record<string, Issue[]>>({})
const keyOf = (rowId: number | null, laneId: number | null) => `${rowId ?? 'none'}:${laneId ?? 'none'}`
watch(rows, (next) => {
  const fresh: Record<string, Issue[]> = {}
  for (const row of next) {
    for (const lane of row.lanes) fresh[keyOf(row.id, lane.id)] = [...lane.issues]
  }
  lists.value = fresh
}, { immediate: true })

/** Qué cambia al dejar una tarjeta en (fila, columna): solo lo que es distinto. */
function changeFor(issue: Issue, rowId: number | null, laneId: number | null): IssueChange {
  const change: IssueChange = {}
  const sprint = props.mode === 'sprint' ? laneId : props.mode === 'matrix' ? rowId : undefined
  const status = props.mode === 'status' ? laneId : props.mode === 'matrix' ? laneId : undefined
  if (status !== undefined && status !== null && status !== issue.status.id) change.status_id = status
  if (sprint !== undefined && sprint !== (issue.fixed_version?.id ?? null)) change.fixed_version_id = sprint
  return change
}

function laneName(rowId: number | null, laneId: number | null): string {
  const row = rows.value.find(r => r.id === rowId)
  const lane = row?.lanes.find(l => l.id === laneId)
  return [props.mode === 'matrix' ? row?.label : null, lane?.label].filter(Boolean).join(' · ')
}

async function moveIssue(issue: Issue, rowId: number | null, laneId: number | null): Promise<void> {
  const change = changeFor(issue, rowId, laneId)
  if (Object.keys(change).length === 0) return
  const optimistic = applyChange(issue, change, { statuses: statuses.value, priorities: session.catalogs.priorities, members: [], versions: versions.value })
  const ok = await changeAsync(issue, change, optimistic, `#${issue.id} movida a ${laneName(rowId, laneId)}`)
  if (!ok) lists.value = { ...lists.value } // el watch ya repone el sitio; esto fuerza el repintado de Sortable
}

function onAdd(rowId: number | null, laneId: number | null, event: { item: HTMLElement }): void {
  const id = Number(event.item.dataset.issue)
  const issue = issues.value.find(i => i.id === id)
  if (issue) void moveIssue(issue, rowId, laneId)
}

const announcement = ref('')

/** `[` / `]` sobre una tarjeta: a la columna anterior o siguiente de su fila. */
function onKeydown(event: KeyboardEvent): void {
  if (event.key !== '[' && event.key !== ']') return
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-issue]')
  if (!target) return
  const id = Number(target.dataset.issue)
  for (const row of rows.value) {
    const index = row.lanes.findIndex(lane => lane.issues.some(issue => issue.id === id))
    if (index < 0) continue
    const next = row.lanes[index + (event.key === ']' ? 1 : -1)]
    const issue = row.lanes[index]!.issues.find(i => i.id === id)!
    event.preventDefault()
    if (!next) {
      announcement.value = 'No hay más columnas en esa dirección'
      return
    }
    announcement.value = `Moviendo #${id} a ${next.label}`
    void moveIssue(issue, row.id, next.id).then(() => {
      nextTick(() => document.querySelector<HTMLElement>(`[data-kanban] [data-issue="${id}"]`)?.focus())
    })
    return
  }
}

// Colapsar: filas (sprints de la matriz) y columnas (se pliegan a una tira, en todas las filas a la vez para que sigan alineadas).
// Las filas empiezan colapsadas: se guardan las abiertas, así las que llegan después también lo están.
const expandedRows = ref(new Set<string>())
const collapsedLanes = ref(new Set<string>())
const isLaneCollapsed = (laneId: number | null) => props.mode === 'matrix' && collapsedLanes.value.has(laneKey(laneId))
const laneKey = (laneId: number | null) => String(laneId ?? 'none')
const rowKey = (rowId: number | null) => String(rowId ?? 'none')

function toggleCollapsed(kind: 'rows' | 'lanes', key: string): void {
  const target = kind === 'rows' ? expandedRows : collapsedLanes
  const next = new Set(target.value)
  if (!next.delete(key)) next.add(key)
  target.value = next
}

// Solo en la matriz (estado / sprint) hay colapso: el botón global pliega los sprints.
const collapsibleKeys = computed(() => props.mode === 'matrix' ? rows.value.map(row => rowKey(row.id)) : [])
const isCollapsed = (key: string) => !expandedRows.value.has(key)
const allCollapsed = computed(() => collapsibleKeys.value.length > 0 && collapsibleKeys.value.every(isCollapsed))
function toggleAll(): void {
  const collapse = !allCollapsed.value
  expandedRows.value = collapse ? new Set() : new Set(collapsibleKeys.value)
}

const LANE_ICON: Record<KanbanMode, string> = { status: 'lucide:circle-dot', sprint: 'lucide:flag', matrix: 'lucide:circle-dot' }
</script>

<template>
  <div
    data-kanban
    class="flex min-h-0 flex-1 flex-col gap-6 px-3 pb-6 wide:px-6"
    @keydown="onKeydown"
  >
    <div
      v-if="isPending"
      class="flex gap-3"
      aria-busy="true"
      aria-label="Cargando el kanban"
    >
      <div
        v-for="n in 4"
        :key="n"
        class="h-64 w-72 shrink-0 rounded-[var(--radius-surface)] bg-fill-selected motion-safe:animate-pulse"
      />
    </div>

    <div
      v-else-if="error"
      role="alert"
      class="flex flex-col items-center gap-2 py-12 text-center"
    >
      <p class="text-secondary">
        No se pudieron cargar las tareas.
      </p>
      <UiButton
        label="Reintentar"
        icon="lucide:rotate-cw"
        @click="refetch()"
      />
    </div>

    <template v-else>
      <div
        v-if="collapsibleKeys.length > 1"
        class="flex justify-end"
      >
        <UiButton
          :label="allCollapsed ? 'Expandir sprints' : 'Colapsar sprints'"
          :icon="allCollapsed ? 'lucide:chevrons-up-down' : 'lucide:chevrons-down-up'"
          variant="ghost"
          @click="toggleAll"
        />
      </div>
      <section
        v-for="row in rows"
        :key="row.id ?? 'none'"
        :aria-label="row.label ?? undefined"
        class="flex min-h-0 flex-col gap-2"
      >
        <h2
          v-if="row.label"
          class="text-[15px] font-semibold"
        >
          <button
            type="button"
            class="flex items-center gap-2 rounded-md py-1 pr-2 text-left hover:bg-fill-selected"
            :aria-expanded="expandedRows.has(rowKey(row.id))"
            @click="toggleCollapsed('rows', rowKey(row.id))"
          >
            <Icon
              name="lucide:chevron-down"
              class="size-4 text-tertiary transition-transform"
              :class="!expandedRows.has(rowKey(row.id)) && '-rotate-90'"
              aria-hidden="true"
            />
            <Icon
              name="lucide:flag"
              class="size-4 text-tertiary"
              aria-hidden="true"
            />
            {{ row.label }}
            <span class="data text-[length:var(--text-caption)] font-normal text-secondary">
              {{ row.lanes.reduce((sum, lane) => sum + lane.issues.length, 0) }}
            </span>
          </button>
        </h2>

        <div
          v-show="!row.label || expandedRows.has(rowKey(row.id))"
          class="flex min-h-0 gap-3 overflow-x-auto pb-2"
        >
          <button
            v-for="lane in row.lanes.filter(l => isLaneCollapsed(l.id))"
            :key="`c-${lane.id ?? 'none'}`"
            type="button"
            class="flex w-11 shrink-0 flex-col items-center gap-2 rounded-[var(--radius-surface)] border border-separator bg-sidebar py-3 hover:bg-fill-selected"
            :style="{ order: row.lanes.indexOf(lane) }"
            :aria-label="`Expandir ${lane.label}, ${lists[keyOf(row.id, lane.id)]?.length ?? 0} tareas`"
            @click="toggleCollapsed('lanes', laneKey(lane.id))"
          >
            <Icon
              name="lucide:chevrons-left-right"
              class="size-3.5 text-tertiary"
              aria-hidden="true"
            />
            <span class="data text-[length:var(--text-caption)] text-secondary">{{ lists[keyOf(row.id, lane.id)]?.length ?? 0 }}</span>
            <span class="panel-label !text-content [writing-mode:vertical-rl]">{{ lane.label }}</span>
          </button>
          <div
            v-for="lane in row.lanes.filter(l => !isLaneCollapsed(l.id))"
            :key="lane.id ?? 'none'"
            :style="{ order: row.lanes.indexOf(lane) }"
            class="flex w-72 shrink-0 flex-col rounded-[var(--radius-surface)] border border-separator bg-sidebar"
            role="group"
            :aria-label="`${lane.label}, ${lists[keyOf(row.id, lane.id)]?.length ?? 0} tareas`"
          >
            <header class="flex min-h-11 items-center gap-2 border-b border-separator px-3">
              <Icon
                :name="LANE_ICON[mode]"
                class="size-3.5 text-tertiary"
                aria-hidden="true"
              />
              <span class="panel-label !text-content">{{ lane.label }}</span>
              <span class="data ml-auto text-[length:var(--text-caption)] text-secondary">{{ lists[keyOf(row.id, lane.id)]?.length ?? 0 }}</span>
              <UiButton
                v-if="mode === 'matrix'"
                :label="`Colapsar ${lane.label}`"
                icon="lucide:chevrons-right-left"
                icon-only
                variant="ghost"
                @click="toggleCollapsed('lanes', laneKey(lane.id))"
              />
            </header>
            <VueDraggable
              v-model="lists[keyOf(row.id, lane.id)]!"
              tag="ul"
              group="kanban"
              :animation="200"
              filter="button"
              :prevent-on-filter="false"
              ghost-class="opacity-40"
              :force-fallback="true"
              :fallback-on-body="true"
              class="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2"
              :class="mode === 'matrix' ? 'max-h-[24rem]' : 'max-h-[calc(100dvh-16rem)]'"
              @add="onAdd(row.id, lane.id, $event)"
            >
              <IssuesIssueCard
                v-for="issue in lists[keyOf(row.id, lane.id)]"
                :key="issue.id"
                :issue="issue"
                variant="tile"
              />
            </VueDraggable>
          </div>
        </div>
      </section>

      <p
        v-if="issues.length === 0"
        class="py-12 text-center text-secondary"
      >
        No tienes tareas abiertas en este board.
      </p>
    </template>

    <p
      class="sr-only"
      role="status"
    >
      {{ announcement }}
    </p>
  </div>
</template>
