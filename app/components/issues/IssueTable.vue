<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import type { IssueColumnId } from '../../../shared/redmine/issue-columns'
import type { IssueSort } from '../../../shared/redmine/issue-query'
import type { Issue } from '../../../shared/redmine/types'
import { tableFeatures, useTable } from '@tanstack/vue-table'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { ISSUE_COLUMN_IDS, ISSUE_COLUMN_LABELS, REQUIRED_COLUMNS, SORT_FIELD } from '../../../shared/redmine/issue-columns'

/**
 * Lista virtualizada de tareas (F2-T03).
 *
 * El orden lo hace Redmine (`sort=`), no la tabla: con páginas de 100 ordenar en
 * cliente mentiría. La tabla de TanStack aporta el modelo de filas y columnas; el
 * scroll virtual, solo las filas visibles.
 */
const props = defineProps<{
  issues: Issue[]
  totalCount: number
  sort: IssueSort
  /** Lista anterior atenuada mientras llega la nueva. */
  stale?: boolean
  hasMore?: boolean
  loadingMore?: boolean
}>()

const emit = defineEmits<{
  'sort': [sort: IssueSort]
  'open': [issue: Issue]
  'log-time': [issue: Issue]
  'load-more': []
}>()

const ui = useUiStore()
const ROW_HEIGHT = 40
const HEADER_HEIGHT = 37
const features = tableFeatures({})

const dateFormat = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' })
const hoursFormat = new Intl.NumberFormat('es', { minimumFractionDigits: 1, maximumFractionDigits: 2 })

const columns = computed(() =>
  ISSUE_COLUMN_IDS.filter(id => ui.issueColumns.includes(id)).map(id => ({
    id,
    header: ISSUE_COLUMN_LABELS[id],
  })) as ColumnDef<typeof features, Issue>[],
)

const table = useTable({
  features,
  columns,
  data: computed(() => props.issues),
  getRowId: (issue: Issue) => String(issue.id),
})

const rows = computed(() => table.getRowModel().rows)
const visibleIds = computed(() => table.getAllLeafColumns().map(c => c.id as IssueColumnId))

/** `#` y acciones son estrechas; Asunto se lleva lo que sobra. */
const WIDTHS: Record<IssueColumnId, string> = {
  id: '5rem',
  subject: 'minmax(16rem, 1fr)',
  status: '9rem',
  priority: '7rem',
  assigned_to: '10rem',
  updated_on: '8rem',
  spent_hours: '5rem',
  actions: '5.5rem',
}
const gridTemplate = computed(() => visibleIds.value.map(id => WIDTHS[id]).join(' '))

const scroller = ref<HTMLElement | null>(null)
const virtualizer = useVirtualizer(computed(() => ({
  count: rows.value.length,
  getScrollElement: () => scroller.value,
  estimateSize: () => ROW_HEIGHT,
  overscan: 8,
})))
const virtualRows = computed(() => virtualizer.value.getVirtualItems())

// Al acercarse al final se pide la página siguiente.
watch(virtualRows, (items) => {
  const last = items.at(-1)
  if (last && props.hasMore && !props.loadingMore && last.index >= rows.value.length - 20) emit('load-more')
})

const selectedId = ref<number | null>(null)
const selectedIndex = computed(() => rows.value.findIndex(r => r.original.id === selectedId.value))

function select(index: number): void {
  const row = rows.value[Math.min(Math.max(index, 0), rows.value.length - 1)]
  if (!row) return
  selectedId.value = row.original.id
  virtualizer.value.scrollToIndex(row.index)
}

/** Menú de acciones de una fila: el "…" o el clic derecho lo abren en su punto. */
const menu = ref<{ issue: Issue, x: number, y: number } | null>(null)
const menuOpen = computed({
  get: () => menu.value !== null,
  set: (open: boolean) => {
    if (!open) menu.value = null
  },
})

function openMenu(issue: Issue, x: number, y: number): void {
  menu.value = { issue, x, y }
}

function openMenuFromButton(issue: Issue, event: MouseEvent): void {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  openMenu(issue, rect.left, rect.bottom)
}

function onKeydown(event: KeyboardEvent): void {
  // Tecla Menú o Mayús+F10: el mismo menú, anclado a la fila seleccionada.
  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
    const row = rows.value[selectedIndex.value]
    const box = scroller.value
    if (row && box) {
      event.preventDefault()
      const item = virtualRows.value.find(v => v.index === selectedIndex.value)
      const top = box.getBoundingClientRect().top + HEADER_HEIGHT + (item?.start ?? 0) - box.scrollTop + ROW_HEIGHT
      openMenu(row.original, box.getBoundingClientRect().left + 120, top)
    }
    return
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return
  if (event.key === 'j' || event.key === 'ArrowDown') {
    event.preventDefault()
    select(selectedIndex.value + 1)
  }
  else if (event.key === 'k' || event.key === 'ArrowUp') {
    event.preventDefault()
    select(selectedIndex.value < 0 ? 0 : selectedIndex.value - 1)
  }
  else if (event.key === 'Enter' && selectedIndex.value >= 0) {
    event.preventDefault()
    emit('open', rows.value[selectedIndex.value]!.original)
  }
}

function sortBy(id: IssueColumnId): void {
  const field = SORT_FIELD[id]
  if (!field) return
  const direction = props.sort.field === field && props.sort.direction === 'asc' ? 'desc' : 'asc'
  emit('sort', { field, direction })
}

function ariaSort(id: IssueColumnId): 'ascending' | 'descending' | 'none' {
  const field = SORT_FIELD[id]
  if (!field || props.sort.field !== field) return 'none'
  return props.sort.direction === 'asc' ? 'ascending' : 'descending'
}

const formatDate = (iso: string): string => dateFormat.format(new Date(iso))

/** Anuncio para lectores de pantalla: cambia con el total, no con cada página. */
const announcement = computed(() =>
  props.totalCount === 1 ? '1 tarea' : `${props.totalCount} tareas`)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="flex items-center justify-between px-3 py-2 text-[length:var(--text-caption)] text-secondary">
      <span
        class="data"
        role="status"
        aria-live="polite"
      >{{ announcement }}</span>

      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <UiButton
            label="Columnas"
            icon="lucide:columns-3"
            icon-only
            variant="ghost"
          />
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent
            class="z-50 min-w-44 rounded-[var(--radius-surface)] border border-separator bg-raised p-1 shadow-lg"
            align="end"
            :side-offset="6"
          >
            <DropdownMenuCheckboxItem
              v-for="id in ISSUE_COLUMN_IDS.filter(c => c !== 'actions')"
              :key="id"
              :model-value="ui.issueColumns.includes(id)"
              :disabled="REQUIRED_COLUMNS.includes(id)"
              class="flex min-h-[var(--control-min)] cursor-default items-center gap-2 rounded-[var(--radius-control)] px-2 text-[length:var(--text-body)] outline-none data-[disabled]:opacity-60 data-[highlighted]:bg-surface"
              @select.prevent="ui.toggleIssueColumn(id)"
            >
              <Icon
                :name="ui.issueColumns.includes(id) ? 'lucide:check' : 'lucide:minus'"
                class="size-4 text-secondary"
                aria-hidden="true"
              />
              {{ ISSUE_COLUMN_LABELS[id] }}
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>

    <div
      ref="scroller"
      role="grid"
      aria-label="Tareas"
      :aria-rowcount="totalCount"
      tabindex="0"
      class="relative min-h-0 flex-1 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-accent"
      :class="{ 'opacity-60 transition-opacity': stale }"
      :aria-busy="stale"
      @keydown="onKeydown"
    >
      <div
        role="row"
        class="sticky top-0 z-10 grid border-b border-separator bg-surface text-[length:var(--text-caption)] text-secondary"
        :style="{ gridTemplateColumns: gridTemplate }"
      >
        <div
          v-for="id in visibleIds"
          :key="id"
          role="columnheader"
          :aria-sort="SORT_FIELD[id] ? ariaSort(id) : undefined"
          class="px-3 py-2 text-left"
        >
          <button
            v-if="SORT_FIELD[id]"
            type="button"
            class="inline-flex items-center gap-1 rounded-[var(--radius-control)] hover:text-content focus-visible:ring-2 focus-visible:ring-accent"
            @click="sortBy(id)"
          >
            {{ ISSUE_COLUMN_LABELS[id] }}
            <Icon
              v-if="ariaSort(id) !== 'none'"
              :name="ariaSort(id) === 'ascending' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
              class="size-3.5"
              aria-hidden="true"
            />
          </button>
          <span
            v-else
            :class="{ 'sr-only': id === 'actions' }"
          >{{ ISSUE_COLUMN_LABELS[id] }}</span>
        </div>
      </div>

      <div
        class="relative"
        :style="{ height: `${virtualizer.getTotalSize()}px` }"
      >
        <div
          v-for="item in virtualRows"
          :key="rows[item.index]!.id"
          role="row"
          :aria-rowindex="item.index + 2"
          :aria-selected="rows[item.index]!.original.id === selectedId"
          class="absolute inset-x-0 grid cursor-default items-center border-b border-separator text-[length:var(--text-body)] hover:bg-raised"
          :class="rows[item.index]!.original.id === selectedId ? 'bg-raised shadow-[inset_2px_0_0_var(--accent)]' : ''"
          :style="{ height: `${ROW_HEIGHT}px`, transform: `translateY(${item.start}px)`, gridTemplateColumns: gridTemplate }"
          @click="selectedId = rows[item.index]!.original.id"
          @dblclick="emit('open', rows[item.index]!.original)"
          @contextmenu.prevent="openMenu(rows[item.index]!.original, $event.clientX, $event.clientY)"
        >
          <template
            v-for="id in visibleIds"
            :key="id"
          >
            <div
              v-if="id === 'id'"
              role="gridcell"
              class="data px-3 text-secondary"
            >
              #{{ rows[item.index]!.original.id }}
            </div>
            <div
              v-else-if="id === 'subject'"
              role="gridcell"
              class="truncate px-3"
            >
              {{ rows[item.index]!.original.subject }}
            </div>
            <div
              v-else-if="id === 'status'"
              role="gridcell"
              class="flex items-center gap-1.5 px-3"
            >
              <Icon
                :name="rows[item.index]!.original.closed_on ? 'lucide:circle-check' : 'lucide:circle-dot'"
                class="size-4 shrink-0 text-secondary"
                aria-hidden="true"
              />
              <span class="truncate">{{ rows[item.index]!.original.status.name }}</span>
            </div>
            <div
              v-else-if="id === 'priority'"
              role="gridcell"
              class="truncate px-3"
            >
              {{ rows[item.index]!.original.priority.name }}
            </div>
            <div
              v-else-if="id === 'assigned_to'"
              role="gridcell"
              class="truncate px-3"
            >
              {{ rows[item.index]!.original.assigned_to?.name ?? '—' }}
            </div>
            <div
              v-else-if="id === 'updated_on'"
              role="gridcell"
              class="data px-3 text-secondary"
            >
              {{ formatDate(rows[item.index]!.original.updated_on) }}
            </div>
            <div
              v-else-if="id === 'spent_hours'"
              role="gridcell"
              class="data px-3 text-right"
            >
              {{ hoursFormat.format(rows[item.index]!.original.spent_hours ?? 0) }}
            </div>
            <div
              v-else
              role="gridcell"
              class="flex items-center gap-0.5 px-1"
            >
              <Can
                permission="log_time"
                :project="rows[item.index]!.original.project.id"
              >
                <UiButton
                  label="Registrar tiempo"
                  icon="lucide:timer"
                  icon-only
                  variant="ghost"
                  @click.stop="emit('log-time', rows[item.index]!.original)"
                />
              </Can>
              <UiButton
                :label="`Acciones de la tarea #${rows[item.index]!.original.id}`"
                icon="lucide:ellipsis"
                icon-only
                variant="ghost"
                aria-haspopup="menu"
                @click.stop="openMenuFromButton(rows[item.index]!.original, $event)"
              />
            </div>
          </template>
        </div>
      </div>
    </div>

    <IssuesIssueActionsMenu
      :issue="menu?.issue ?? null"
      :x="menu?.x ?? 0"
      :y="menu?.y ?? 0"
      :open="menuOpen"
      @update:open="menuOpen = $event"
    />
  </div>
</template>
