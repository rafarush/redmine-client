<script setup lang="ts">
import type { FilterOption } from '../../shared/redmine/filter-fields'
import type { FilterSentence } from '../../shared/redmine/filters'
import type { IssueSort } from '../../shared/redmine/issue-query'
import { fromUrl, toUrl } from '../../shared/redmine/filters'
import { DEFAULT_SORT } from '../../shared/redmine/issue-query'

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
const toasts = useToastStore()

/** Hay algo que quitar: condiciones en la frase o una consulta guardada. */
const filtered = computed(() => sentence.value.conditions.length > 0 || savedQuery.value !== null)
function clearFilters(): void {
  router.push({ query: { ...route.query, f: undefined, q: undefined, p: undefined } })
}

/** El detalle de tarea llega en F3: hasta entonces Enter y doble clic lo dicen en vez de callar. */
function openIssue(): void {
  toasts.show('El detalle de la tarea estará disponible pronto')
}

/** Personas que aparecen en la lista, para ofrecerlas en "Asignado a" y "Autor". */
const people = computed<FilterOption[]>(() => {
  const seen = new Map<number, string>()
  for (const issue of issues.value) {
    if (issue.assigned_to) seen.set(issue.assigned_to.id, issue.assigned_to.name)
    if (issue.author) seen.set(issue.author.id, issue.author.name)
  }
  return [...seen].map(([id, name]) => ({ value: String(id), label: name }))
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div
      v-if="savedQuery"
      class="flex items-center gap-2 border-b border-separator bg-surface px-2 py-1.5"
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
      @update:model-value="setSentence"
    >
      <template #trailing>
        <FiltersSaveFilter
          :disabled="sentence.conditions.length === 0"
          @save="ui.saveCurrentFilter($event, toUrl(sentence))"
        />
      </template>
    </FiltersFilterSentence>
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
      @sort="sort = $event"
      @open="openIssue"
      @retry="refetch()"
      @clear-filters="clearFilters"
      @load-more="fetchNextPage()"
    />
  </div>
</template>
