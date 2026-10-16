<script setup lang="ts">
import type { Issue } from '../../../shared/redmine/types'
import { useQuery } from '@tanstack/vue-query'
import { ListboxContent, ListboxFilter, ListboxItem, ListboxRoot } from 'reka-ui'
import { parseSearch } from '../../../shared/redmine/palette'

/**
 * Elegir varias tareas buscando por `#número` o por asunto (F2c-T11). Sin texto,
 * propone las abiertas asignadas a mí. La selección se conserva al cambiar la
 * búsqueda; las tareas de `exclude` salen marcadas y no se pueden elegir.
 */
const model = defineModel<number[]>({ default: () => [] })
const props = defineProps<{
  /** Tareas que la lista ya tiene. */
  exclude?: number[]
}>()

const redmine = useRedmine()
const text = ref('')
const term = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(text, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    term.value = value
  }, 200)
})
onBeforeUnmount(() => clearTimeout(timer))

const search = computed(() => parseSearch(term.value))
const results = useQuery({
  queryKey: computed(() => ['issue-multi-picker', term.value]),
  queryFn: async () => {
    const s = search.value
    if (s.kind === 'issue-id') return (await redmine.listIssues({ issue_id: s.id, status_id: 'open' })).items
    if (s.kind === 'text') return (await redmine.listIssues({ subject: `~${s.text}`, status_id: 'open', limit: 20, sort: 'updated_on:desc' })).items
    return (await redmine.listIssues({ assigned_to_id: 'me', status_id: 'open', limit: 20, sort: 'updated_on:desc' })).items
  },
  staleTime: 30_000,
})
const items = computed<Issue[]>(() => results.data.value ?? [])
const existing = computed(() => new Set(props.exclude ?? []))

function clear(): void {
  model.value = []
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-baseline justify-between gap-2">
      <span class="panel-label">Tareas</span>
      <span class="text-[length:var(--text-caption)] text-secondary">
        {{ model.length === 0 ? 'Marca las que quieras añadir.' : model.length === 1 ? '1 seleccionada' : `${model.length} seleccionadas` }}
        <button
          v-if="model.length > 0"
          type="button"
          class="ml-1 rounded-[var(--radius-plate)] px-1 underline outline-none focus-visible:ring-2 focus-visible:ring-accent"
          @click="clear"
        >
          Quitar selección
        </button>
      </span>
    </div>

    <ListboxRoot
      v-model="model"
      multiple
      class="overflow-hidden rounded-[var(--radius-control)] border border-separator"
    >
      <ListboxFilter
        v-model="text"
        placeholder="Buscar por #número o por asunto…"
        aria-label="Buscar tareas"
        class="w-full border-b border-separator bg-surface px-2.5 py-2"
      />
      <ListboxContent
        class="max-h-64 overflow-y-auto p-1"
        aria-label="Tareas encontradas"
      >
        <ListboxItem
          v-for="issue in items"
          :key="issue.id"
          :value="issue.id"
          :disabled="existing.has(issue.id)"
          class="flex min-h-[var(--control-min)] cursor-pointer items-center gap-2 rounded-[var(--radius-plate)] px-2 data-[disabled]:cursor-default data-[disabled]:opacity-60 data-[highlighted]:bg-fill-hover data-[state=checked]:bg-fill-selected"
        >
          <span class="data shrink-0 text-secondary">#{{ issue.id }}</span>
          <span class="min-w-0 flex-1 truncate">{{ issue.subject }}</span>
          <span
            v-if="existing.has(issue.id)"
            class="shrink-0 text-[length:var(--text-caption)] text-secondary"
          >Ya en la lista</span>
          <Icon
            v-else-if="model.includes(issue.id)"
            name="lucide:check"
            class="size-4 shrink-0"
            aria-hidden="true"
          />
        </ListboxItem>
        <p
          v-if="results.isPending.value"
          class="px-2 py-3 text-secondary"
        >
          Buscando…
        </p>
        <p
          v-else-if="results.isError.value"
          role="alert"
          class="px-2 py-3 text-secondary"
        >
          No se pudo buscar. Inténtalo de nuevo.
        </p>
        <p
          v-else-if="items.length === 0"
          class="px-2 py-3 text-secondary"
        >
          Ninguna tarea abierta coincide.
        </p>
      </ListboxContent>
    </ListboxRoot>
  </div>
</template>
