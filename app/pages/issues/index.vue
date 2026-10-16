<script setup lang="ts">
import type { FilterSentence } from '../../../shared/redmine/filters'
import type { IssueSort } from '../../../shared/redmine/issue-query'
import type { Issue } from '../../../shared/redmine/types'
import { fromUrl, toUrl } from '../../../shared/redmine/filters'
import { DEFAULT_SORT } from '../../../shared/redmine/issue-query'

definePageMeta({ title: 'Tareas' })

/**
 * Pantalla principal: frase de filtros + lista de tareas.
 * La frase vive en la URL (`?f=`): cada cambio es una entrada del historial, así
 * que atrás/adelante recorren los filtros y el enlace se puede compartir.
 */
const route = useRoute()
const router = useRouter()

const sentence = computed(() => fromUrl(typeof route.query.f === 'string' ? route.query.f : null))
function setSentence(next: FilterSentence): void {
  const f = toUrl(next)
  router.push({ query: { ...route.query, f: f || undefined } })
}

/** Consulta guardada de Redmine (`?q=<id>&p=<proyecto>`): no se puede editar como frase. */
const { queries } = useSavedQueries()
const ui = useUiStore()
const savedQuery = computed(() => {
  const id = Number(route.query.q)
  if (!Number.isInteger(id) || id <= 0) return null
  const project = Number(route.query.p)
  return { id, projectId: Number.isInteger(project) && project > 0 ? project : null }
})
const savedQueryName = computed(() => queries.value.find(q => q.id === savedQuery.value?.id)?.name ?? 'Consulta guardada')
function clearSavedQuery(): void {
  router.push({ query: { ...route.query, q: undefined, p: undefined } })
}

const sort = ref<IssueSort>({ ...DEFAULT_SORT })
const { issues, totalCount, isStale, isPending, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = useIssues({ sentence, sort, savedQuery })

/** Hay algo que quitar: condiciones en la frase o una consulta guardada. */
const filtered = computed(() => sentence.value.conditions.length > 0 || savedQuery.value !== null)
function clearFilters(): void {
  router.push({ query: { ...route.query, f: undefined, q: undefined, p: undefined } })
}

// ------------------------------------------------- detalle en panel (F3-T01)

/**
 * Enter y doble clic abren el detalle: en ancho regular, en un panel a la derecha
 * (`?issue=ID`, así atrás lo cierra y el enlace se comparte); en compacto, la página
 * de la tarea. Abrir otra tarea reemplaza el panel sin recargar.
 */
const wide = ref(false)
let media: MediaQueryList | undefined
const syncWide = () => {
  wide.value = !!media?.matches
}
onMounted(() => {
  media = window.matchMedia('(min-width: 900px)')
  syncWide()
  media.addEventListener('change', syncWide)
})
onBeforeUnmount(() => media?.removeEventListener('change', syncWide))

const openId = computed(() => {
  const id = Number(route.query.issue)
  return Number.isInteger(id) && id > 0 ? id : null
})
const showPanel = computed(() => wide.value && openId.value !== null)

function openIssue(issue: Issue): void {
  if (!wide.value) {
    void navigateTo(`/issues/${issue.id}`)
    return
  }
  // Cambiar de tarea con el panel abierto no apila historial; abrirlo sí.
  const target = { query: { ...route.query, issue: String(issue.id) } }
  if (openId.value) void router.replace(target)
  else void router.push(target)
}

const listArea = useTemplateRef<HTMLElement>('listArea')

/** Cerrar devuelve el foco a la lista, con la fila que estaba seleccionada. */
function closePanel(): void {
  void router.push({ query: { ...route.query, issue: undefined } })
  void nextTick(() => listArea.value?.querySelector<HTMLElement>('[role="grid"]')?.focus())
}

/** Esc cierra el panel, salvo que algo (un editor, un popover) ya lo haya usado. */
function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.defaultPrevented || !showPanel.value) return
  event.preventDefault()
  closePanel()
}

const WIDTH_KEY = 'redmine-client:detail-width'
const MIN_WIDTH = 360
const panelWidth = ref(480)
onMounted(() => {
  try {
    const saved = Number(localStorage.getItem(WIDTH_KEY))
    if (saved >= MIN_WIDTH) panelWidth.value = saved
  }
  catch {
    // Sin almacenamiento se queda el ancho por defecto.
  }
})

function maxWidth(): number {
  return Math.max(MIN_WIDTH, Math.round((listArea.value?.parentElement?.clientWidth ?? 1200) * 0.6))
}

function setWidth(value: number): void {
  panelWidth.value = Math.min(maxWidth(), Math.max(MIN_WIDTH, Math.round(value)))
  try {
    localStorage.setItem(WIDTH_KEY, String(panelWidth.value))
  }
  catch {
    // Ver arriba.
  }
}

/** Arrastrar el separador: el panel crece hacia la izquierda. */
function startResize(event: PointerEvent): void {
  const handle = event.currentTarget as HTMLElement
  handle.setPointerCapture(event.pointerId)
  const startX = event.clientX
  const startWidth = panelWidth.value
  const move = (e: PointerEvent) => setWidth(startWidth + (startX - e.clientX))
  const up = () => {
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', up)
  }
  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', up)
}

function onResizeKey(event: KeyboardEvent): void {
  const step = event.shiftKey ? 64 : 16
  if (event.key === 'ArrowLeft') setWidth(panelWidth.value + step)
  else if (event.key === 'ArrowRight') setWidth(panelWidth.value - step)
  else return
  event.preventDefault()
}

/** Popover "Registrar tiempo" (F4-T03): uno para toda la lista, anclado al ⏱ de la fila. */
const logging = reactive<{ open: boolean, issue: Issue | null, anchor: Element | null }>({ open: false, issue: null, anchor: null })
function logTime(issue: Issue, anchor?: Element): void {
  logging.issue = issue
  logging.anchor = anchor ?? null
  logging.open = true
}

/** Personas y campos personalizados que ofrece la frase (F2-T10). */
const { people, customFields } = useFilterCatalog(sentence, issues)
</script>

<template>
  <div
    class="flex h-full min-h-0 flex-col"
    @keydown="onKeydown"
  >
    <div
      v-if="savedQuery"
      class="mx-3 mb-2 flex items-center gap-2 rounded-[var(--radius-control)] bg-fill-selected py-1 pl-3 pr-1 wide:mx-6"
    >
      <Icon
        name="lucide:bookmark"
        class="size-4 shrink-0 text-secondary"
        aria-hidden="true"
      />
      <p class="min-w-0 flex-1 truncate text-[length:var(--text-body)] text-content">
        {{ savedQueryName }}
        <span class="text-secondary">· Consulta de Redmine, no editable</span>
      </p>
      <UiButton
        variant="ghost"
        label="Volver a los filtros"
        icon="lucide:x"
        @click="clearSavedQuery"
      />
    </div>
    <FiltersFilterSentence
      v-else
      :model-value="sentence"
      :people="people"
      :custom-fields="customFields"
      @update:model-value="setSentence"
    >
      <template #trailing>
        <FiltersSaveFilter
          :disabled="sentence.conditions.length === 0"
          @save="ui.saveCurrentFilter($event, toUrl(sentence))"
        />
      </template>
    </FiltersFilterSentence>
    <div class="flex min-h-0 flex-1">
      <div
        ref="listArea"
        class="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <IssuesIssueTable
          :issues="issues"
          :total-count="totalCount"
          :sort="sort"
          :stale="isStale"
          :has-more="hasNextPage"
          :loading-more="isFetchingNextPage"
          :loading="isPending"
          :error="error"
          :filtered="filtered"
          time-logging
          @sort="sort = $event"
          @open="openIssue"
          @retry="refetch()"
          @clear-filters="clearFilters"
          @load-more="fetchNextPage()"
          @log-time="logTime"
        />
      </div>

      <template v-if="showPanel">
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Ancho del panel de detalle"
          :aria-valuenow="panelWidth"
          :aria-valuemin="MIN_WIDTH"
          tabindex="0"
          class="group relative w-1.5 shrink-0 cursor-col-resize bg-transparent outline-none transition-colors hover:bg-fill-hover focus-visible:bg-fill-hover active:bg-fill-selected after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-transparent after:transition-colors hover:after:bg-accent focus-visible:after:bg-accent active:after:bg-accent"
          @pointerdown.prevent="startResize"
          @keydown="onResizeKey"
        />
        <aside
          aria-label="Detalle de la tarea"
          class="min-h-0 shrink-0 overflow-y-auto border-l border-separator bg-surface"
          :style="{ width: `${panelWidth}px` }"
        >
          <IssuesIssueDetail
            :id="openId!"
            embedded
            @close="closePanel"
          />
        </aside>
      </template>
    </div>

    <TimeLogTimePopover
      v-model:open="logging.open"
      :issue="logging.issue"
      :anchor="logging.anchor"
    />
  </div>
</template>
