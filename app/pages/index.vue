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

const sort = ref<IssueSort>({ ...DEFAULT_SORT })
const { issues, totalCount, isStale, hasNextPage, isFetchingNextPage, fetchNextPage } = useIssues({ sentence, sort })

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
    <FiltersFilterSentence
      :model-value="sentence"
      :people="people"
      @update:model-value="setSentence"
    />
    <IssuesIssueTable
      :issues="issues"
      :total-count="totalCount"
      :sort="sort"
      :stale="isStale"
      :has-more="hasNextPage"
      :loading-more="isFetchingNextPage"
      @sort="sort = $event"
      @load-more="fetchNextPage()"
    />
  </div>
</template>
