<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import type { IssueColumnId } from '../../../shared/redmine/issue-columns'
import type { IssueSort } from '../../../shared/redmine/issue-query'
import type { Issue } from '../../../shared/redmine/types'
import { tableFeatures, useTable } from '@tanstack/vue-table'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { ISSUE_COLUMN_IDS, ISSUE_COLUMN_LABELS, REQUIRED_COLUMNS, SORT_FIELD } from '../../../shared/redmine/issue-columns'
import { PRIORITY_ICON, priorityLevel, statusIcon, statusTone } from '../../../shared/redmine/issue-display'
import { timerFor } from '../../../shared/workspace/flow'

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
  /** Primera carga, sin lista anterior que mostrar. */
  loading?: boolean
  error?: Error | null
  /** Hay filtros activos: el vacío ofrece quitarlos. */
  filtered?: boolean
  /** El botón de registrar tiempo sale cuando existe el popover (F4). */
  timeLogging?: boolean
}>()

const emit = defineEmits<{
  'sort': [sort: IssueSort]
  'open': [issue: Issue]
  /** `anchor`: el elemento al que anclar el popover de tiempo (el ⏱ de la fila). */
  'log-time': [issue: Issue, anchor?: Element]
  'load-more': []
  'retry': []
  'clear-filters': []
}>()

const ui = useUiStore()
const session = useSessionStore()
const flow = useCardFlow()
const workspace = useWorkspaceStore()

/** ▶ sin cronómetro o en pausa; ⏸ si corre. */
function timerOf(issue: Issue) {
  return timerFor(workspace.timers, issue.id)
}
function timerLabel(issue: Issue): string {
  const timer = timerOf(issue)
  return !timer ? `Iniciar el cronómetro de #${issue.id}` : timer.paused ? `Reanudar el cronómetro de #${issue.id}` : `Pausar el cronómetro de #${issue.id}`
}
function timerIcon(issue: Issue): string {
  const timer = timerOf(issue)
  return !timer || timer.paused ? 'lucide:play' : 'lucide:pause'
}
/** Cabecera de columnas: su alto se mide al usarlo (cambia con el zoom). */
const header = ref<HTMLElement | null>(null)

// En compacto (<900 px) cada tarea es una tarjeta de dos líneas; con puntero táctil
// las filas respetan el objetivo de 44 pt.
const compact = ref(false)
const coarse = ref(false)
const ROW_HEIGHT = computed(() => compact.value ? 72 : coarse.value ? 48 : 40)
const mediaQueries: MediaQueryList[] = []
function syncMedia(): void {
  compact.value = window.matchMedia('(max-width: 899px)').matches
  coarse.value = window.matchMedia('(pointer: coarse)').matches
}
onMounted(() => {
  syncMedia()
  for (const query of ['(max-width: 899px)', '(pointer: coarse)']) {
    const media = window.matchMedia(query)
    media.addEventListener('change', syncMedia)
    mediaQueries.push(media)
  }
})
onBeforeUnmount(() => mediaQueries.forEach(media => media.removeEventListener('change', syncMedia)))
const features = tableFeatures({})

const dateFormat = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' })

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
const gridTemplate = computed(() => compact.value ? 'minmax(0, 1fr) auto' : visibleIds.value.map(id => WIDTHS[id]).join(' '))

// Al cambiar el alto de fila el virtualizador vuelve a medir.
watch(ROW_HEIGHT, () => virtualizer.value.measure())

const scroller = ref<HTMLElement | null>(null)
const virtualizer = useVirtualizer(computed(() => ({
  count: rows.value.length,
  getScrollElement: () => scroller.value,
  estimateSize: () => ROW_HEIGHT.value,
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

/** Menú de una fila: el de toda la app (`IssueContextMenu`), abierto en el punto pulsado. */
const issueMenu = useIssueMenu()

function openMenu(issue: Issue, x: number, y: number): void {
  issueMenu.open(issue, x, y)
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
      const top = box.getBoundingClientRect().top + (header.value?.offsetHeight ?? 0) + (item?.start ?? 0) - box.scrollTop + ROW_HEIGHT.value
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
  // `P`: iniciar, pausar o reanudar el cronómetro de la fila (F4-T08).
  else if ((event.key === 'p' || event.key === 'P') && props.timeLogging && selectedIndex.value >= 0) {
    const issue = rows.value[selectedIndex.value]!.original
    if (!session.can('log_time', issue.project.id)) return
    event.preventDefault()
    flow.toggleTimer(issue)
  }
  // `T`: registrar tiempo en la fila seleccionada (F4-T03), anclado a su ⏱.
  else if ((event.key === 't' || event.key === 'T') && props.timeLogging && selectedIndex.value >= 0) {
    const issue = rows.value[selectedIndex.value]!.original
    if (!session.can('log_time', issue.project.id)) return
    event.preventDefault()
    emit('log-time', issue, scroller.value?.querySelector(`[data-log-time="${issue.id}"]`) ?? scroller.value ?? undefined)
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
const announcement = computed(() => {
  const count = props.totalCount === 1 ? '1 tarea' : `${props.totalCount} tareas`
  return props.stale ? `${count} · Actualizando…` : count
})

const TONE_CLASS = { info: 'text-info', success: 'text-success', warning: 'text-warning', neutral: 'text-secondary' } as const
const isClosed = (issue: Issue): boolean => !!issue.closed_on

/** Nivel de prioridad según su sitio en la enumeración de Redmine; sin catálogo, "normal". */
function priorityIconOf(issue: Issue): string {
  const list = session.catalogs.priorities
  const position = list.findIndex(p => p.id === issue.priority.id)
  const defaultPosition = Math.max(0, list.findIndex(p => p.is_default))
  return PRIORITY_ICON[position < 0 ? 'normal' : priorityLevel(position, defaultPosition)]
}
const isUrgent = (issue: Issue): boolean => priorityIconOf(issue) === PRIORITY_ICON.urgent
const isRaised = (issue: Issue): boolean => isUrgent(issue) || priorityIconOf(issue) === PRIORITY_ICON.high
const sortableIds = computed(() => ISSUE_COLUMN_IDS.filter(id => SORT_FIELD[id]))
const SKELETON_ROWS = 8
const showEmpty = computed(() => !props.loading && !props.error && props.issues.length === 0)
const showList = computed(() => props.issues.length > 0)
const errorMessage = computed(() => props.error?.message || 'Redmine no respondió.')
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col px-3 pb-3 wide:px-6 wide:pb-6">
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-surface)] border border-separator bg-raised shadow-panel">
      <div class="flex min-h-11 items-center justify-between pl-4 pr-2">
        <span
          class="panel-label data"
          role="status"
          aria-live="polite"
        >{{ announcement }}</span>

        <div class="flex items-center gap-1">
          <DropdownMenuRoot v-if="compact">
            <DropdownMenuTrigger as-child>
              <UiButton
                label="Ordenar"
                icon="lucide:arrow-up-down"
                icon-only
                variant="ghost"
              />
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent
                class="ui-pop z-50 min-w-44 rounded-[var(--radius-surface)] border border-separator bg-raised p-1 shadow-popover"
                align="end"
                :side-offset="6"
              >
                <DropdownMenuItem
                  v-for="id in sortableIds"
                  :key="id"
                  class="flex min-h-[var(--control-min)] cursor-default items-center gap-2 rounded-[var(--radius-control)] px-2 text-[length:var(--text-body)] outline-none data-[highlighted]:bg-fill-selected"
                  @select="sortBy(id)"
                >
                  <Icon
                    :name="ariaSort(id) === 'none' ? 'lucide:minus' : ariaSort(id) === 'ascending' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
                    class="size-4 text-secondary"
                    aria-hidden="true"
                  />
                  {{ ISSUE_COLUMN_LABELS[id] }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenuRoot>

          <DropdownMenuRoot v-else>
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
                class="ui-pop z-50 min-w-44 rounded-[var(--radius-surface)] border border-separator bg-raised p-1 shadow-popover"
                align="end"
                :side-offset="6"
              >
                <DropdownMenuCheckboxItem
                  v-for="id in ISSUE_COLUMN_IDS.filter(c => c !== 'actions')"
                  :key="id"
                  :model-value="ui.issueColumns.includes(id)"
                  :disabled="REQUIRED_COLUMNS.includes(id)"
                  class="flex min-h-[var(--control-min)] cursor-default items-center gap-2 rounded-[var(--radius-control)] px-2 text-[length:var(--text-body)] outline-none data-[disabled]:opacity-60 data-[highlighted]:bg-fill-selected"
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
      </div>

      <!-- Primera carga: esqueleto con la forma de la lista. -->
      <div
        v-if="loading && !showList"
        class="min-h-0 flex-1 overflow-hidden"
        aria-busy="true"
        aria-label="Cargando tareas"
      >
        <div
          v-for="n in SKELETON_ROWS"
          :key="n"
          class="flex items-center gap-4 px-4 even:bg-fill-alt"
          :style="{ height: `${ROW_HEIGHT}px` }"
          aria-hidden="true"
        >
          <span class="h-3 w-12 rounded-[var(--radius-plate)] bg-fill-selected motion-safe:animate-pulse" />
          <span
            class="h-3 rounded-[var(--radius-plate)] bg-fill-selected motion-safe:animate-pulse"
            :style="{ width: `${28 + ((n * 17) % 40)}%` }"
          />
        </div>
      </div>

      <!-- Fallo al cargar: dice qué pasó y deja reintentar. -->
      <div
        v-else-if="error && !showList"
        role="alert"
        class="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <Icon
          name="lucide:cloud-off"
          class="size-6 text-tertiary"
          aria-hidden="true"
        />
        <div>
          <p class="text-[length:var(--text-title)] font-semibold text-content">
            No se pudieron cargar las tareas
          </p>
          <p class="mt-1 text-[length:var(--text-body)] text-secondary">
            {{ errorMessage }}
          </p>
        </div>
        <UiButton
          label="Reintentar"
          icon="lucide:rotate-cw"
          @click="emit('retry')"
        />
      </div>

      <!-- Sin resultados: si hay filtros, la salida está a un clic. -->
      <div
        v-else-if="showEmpty"
        class="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <Icon
          name="lucide:inbox"
          class="size-6 text-tertiary"
          aria-hidden="true"
        />
        <div>
          <p class="text-[length:var(--text-title)] font-semibold text-content">
            {{ filtered ? 'Ninguna tarea coincide' : 'No hay tareas' }}
          </p>
          <p class="mt-1 text-[length:var(--text-body)] text-secondary">
            {{ filtered ? 'Prueba con menos filtros.' : 'Las tareas que crees o te asignen saldrán aquí.' }}
          </p>
        </div>
        <UiButton
          v-if="filtered"
          label="Quitar filtros"
          @click="emit('clear-filters')"
        />
      </div>

      <div
        v-else
        ref="scroller"
        role="grid"
        aria-label="Tareas"
        :aria-rowcount="totalCount"
        :aria-activedescendant="selectedId ? `issue-row-${selectedId}` : undefined"
        tabindex="0"
        class="relative min-h-0 flex-1 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        :class="{ 'opacity-60 motion-safe:transition-opacity': stale }"
        :aria-busy="stale"
        @keydown="onKeydown"
      >
        <div
          v-if="!compact"
          ref="header"
          role="row"
          class="sticky top-0 z-10 grid border-y border-separator bg-raised"
          :style="{ gridTemplateColumns: gridTemplate }"
        >
          <div
            v-for="id in visibleIds"
            :key="id"
            role="columnheader"
            :aria-sort="SORT_FIELD[id] ? ariaSort(id) : undefined"
            class="px-3 py-2 text-left first:pl-4"
          >
            <button
              v-if="SORT_FIELD[id]"
              type="button"
              class="panel-label group/sort inline-flex items-center gap-1 rounded-[var(--radius-plate)] hover:text-content"
              :class="{ 'font-semibold text-content': ariaSort(id) !== 'none' }"
              @click="sortBy(id)"
            >
              {{ ISSUE_COLUMN_LABELS[id] }}
              <Icon
                :name="ariaSort(id) === 'none' ? 'lucide:arrow-up-down' : ariaSort(id) === 'ascending' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
                class="size-3.5"
                :class="{ 'opacity-0 group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100': ariaSort(id) === 'none' }"
                aria-hidden="true"
              />
            </button>
            <span
              v-else
              class="panel-label"
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
            :id="`issue-row-${rows[item.index]!.original.id}`"
            :key="rows[item.index]!.id"
            role="row"
            :aria-rowindex="item.index + 2"
            :aria-selected="rows[item.index]!.original.id === selectedId"
            class="group absolute inset-x-0 grid cursor-default items-center text-[length:var(--text-body)]"
            :class="rows[item.index]!.original.id === selectedId ? 'bg-fill-selected' : item.index % 2 ? 'bg-fill-alt hover:bg-fill-hover' : 'hover:bg-fill-hover'"
            :style="{ height: `${ROW_HEIGHT}px`, transform: `translateY(${item.start}px)`, gridTemplateColumns: gridTemplate }"
            @click="selectedId = rows[item.index]!.original.id"
            @dblclick="emit('open', rows[item.index]!.original)"
            @contextmenu.prevent="openMenu(rows[item.index]!.original, $event.clientX, $event.clientY)"
          >
            <!-- Compacto: asunto arriba; #id, estado y fecha debajo. -->
            <template v-if="compact">
              <div
                role="gridcell"
                class="min-w-0 px-3"
              >
                <p
                  class="truncate font-medium"
                  :class="isClosed(rows[item.index]!.original) ? 'text-secondary' : 'text-content'"
                >
                  {{ rows[item.index]!.original.subject }}
                </p>
                <p class="mt-0.5 flex items-center gap-2 text-[length:var(--text-caption)] text-secondary">
                  <span class="data">#{{ rows[item.index]!.original.id }}</span>
                  <span
                    class="inline-flex min-w-0 items-center gap-1"
                    :class="TONE_CLASS[statusTone(isClosed(rows[item.index]!.original))]"
                  >
                    <Icon
                      :name="statusIcon(isClosed(rows[item.index]!.original))"
                      class="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span class="truncate">{{ rows[item.index]!.original.status.name }}</span>
                  </span>
                  <span
                    v-if="isRaised(rows[item.index]!.original)"
                    class="inline-flex items-center gap-1 text-content"
                  >
                    <Icon
                      :name="priorityIconOf(rows[item.index]!.original)"
                      class="size-3.5"
                      aria-hidden="true"
                    />
                    {{ rows[item.index]!.original.priority.name }}
                  </span>
                  <span class="data ml-auto shrink-0">{{ formatDate(rows[item.index]!.original.updated_on) }}</span>
                </p>
              </div>
              <div
                role="gridcell"
                class="pr-1"
              >
                <UiButton
                  :label="`Acciones de la tarea #${rows[item.index]!.original.id}`"
                  icon="lucide:ellipsis"
                  icon-only
                  variant="ghost"
                  tabindex="-1"
                  aria-haspopup="menu"
                  @click.stop="openMenuFromButton(rows[item.index]!.original, $event)"
                />
              </div>
            </template>

            <template v-else>
              <template
                v-for="id in visibleIds"
                :key="id"
              >
                <div
                  v-if="id === 'id'"
                  role="gridcell"
                  class="data pl-4 pr-3 text-secondary"
                >
                  {{ rows[item.index]!.original.id }}
                </div>
                <div
                  v-else-if="id === 'subject'"
                  role="gridcell"
                  class="truncate px-3 font-medium"
                  :class="isClosed(rows[item.index]!.original) ? 'text-secondary' : 'text-content'"
                >
                  {{ rows[item.index]!.original.subject }}
                </div>
                <div
                  v-else-if="id === 'status'"
                  role="gridcell"
                  class="flex items-center gap-1.5 px-3"
                  :class="TONE_CLASS[statusTone(isClosed(rows[item.index]!.original))]"
                >
                  <Icon
                    :name="statusIcon(isClosed(rows[item.index]!.original))"
                    class="size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span class="truncate text-content">{{ rows[item.index]!.original.status.name }}</span>
                </div>
                <div
                  v-else-if="id === 'priority'"
                  role="gridcell"
                  class="flex items-center gap-1.5 px-3"
                  :class="isUrgent(rows[item.index]!.original) ? 'font-semibold text-content' : 'text-secondary'"
                >
                  <Icon
                    :name="priorityIconOf(rows[item.index]!.original)"
                    class="size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span class="truncate">{{ rows[item.index]!.original.priority.name }}</span>
                </div>
                <div
                  v-else-if="id === 'assigned_to'"
                  role="gridcell"
                  class="truncate px-3 text-secondary"
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
                  class="data px-3 text-right text-secondary"
                >
                  <TimeRollingHours
                    :hours="rows[item.index]!.original.spent_hours"
                    :issue-id="rows[item.index]!.original.id"
                  />
                </div>
                <!-- Acciones: al pasar el ratón, enfocar o seleccionar; siempre en táctil. -->
                <div
                  v-else
                  role="gridcell"
                  class="flex items-center gap-0.5 px-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
                  :class="{ 'opacity-100': rows[item.index]!.original.id === selectedId }"
                >
                  <Can
                    v-if="timeLogging"
                    permission="log_time"
                    :project="rows[item.index]!.original.project.id"
                  >
                    <!-- Cronómetro (F4-T08): el mismo del workspace; arrancarlo pone la tarea en curso. -->
                    <UiButton
                      :label="timerLabel(rows[item.index]!.original)"
                      :icon="timerIcon(rows[item.index]!.original)"
                      icon-only
                      variant="ghost"
                      tabindex="-1"
                      @click.stop="flow.toggleTimer(rows[item.index]!.original)"
                    />
                    <UiButton
                      label="Registrar tiempo"
                      icon="lucide:timer"
                      icon-only
                      variant="ghost"
                      tabindex="-1"
                      :data-log-time="rows[item.index]!.original.id"
                      @click.stop="emit('log-time', rows[item.index]!.original, $event.currentTarget as Element)"
                    />
                  </Can>
                  <UiButton
                    :label="`Acciones de la tarea #${rows[item.index]!.original.id}`"
                    icon="lucide:ellipsis"
                    icon-only
                    variant="ghost"
                    tabindex="-1"
                    aria-haspopup="menu"
                    @click.stop="openMenuFromButton(rows[item.index]!.original, $event)"
                  />
                </div>
              </template>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
