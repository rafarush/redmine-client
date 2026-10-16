<script setup lang="ts">
import type { Issue } from '../../../shared/redmine/types'
import { useQuery } from '@tanstack/vue-query'
import { parseIssueSearch } from '../../../shared/redmine/relations'

/**
 * Buscar una tarea por `#número` o por texto del asunto (F3-T05). Las flechas
 * recorren los resultados y Enter elige; Esc limpia.
 */
const props = defineProps<{
  label: string
  /** Tareas que no deben salir (la propia, las ya vinculadas). */
  exclude?: number[]
}>()
const emit = defineEmits<{ pick: [issue: Issue] }>()

const redmine = useRedmine()
const text = ref('')
const term = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(text, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    term.value = value
  }, 250)
})
onBeforeUnmount(() => clearTimeout(timer))

const search = computed(() => parseIssueSearch(term.value))
const results = useQuery({
  queryKey: computed(() => ['issue-search', term.value]),
  queryFn: async () => {
    const s = search.value!
    const query = 'id' in s ? { issue_id: s.id, status_id: '*' } : { subject: `~${s.subject}`, status_id: '*', limit: 8 }
    return (await redmine.listIssues(query)).items
  },
  enabled: computed(() => !!search.value && ('id' in search.value || search.value.subject.length >= 2)),
  staleTime: 30_000,
})
const items = computed(() => (results.data.value ?? []).filter(i => !props.exclude?.includes(i.id)))

const active = ref(0)
watch(items, () => {
  active.value = 0
})
const listId = useId()
const activeId = computed(() => {
  const issue = items.value[active.value]
  return issue ? `${listId}-${issue.id}` : undefined
})

function choose(issue: Issue | undefined): void {
  if (!issue) return
  emit('pick', issue)
  text.value = ''
  term.value = ''
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    active.value = Math.min(items.value.length - 1, active.value + 1)
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault()
    active.value = Math.max(0, active.value - 1)
  }
  else if (event.key === 'Enter') {
    event.preventDefault()
    choose(items.value[active.value])
  }
  else if (event.key === 'Escape') {
    text.value = ''
    term.value = ''
  }
}
</script>

<template>
  <div class="relative min-w-0 flex-1">
    <Icon
      name="lucide:search"
      class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-secondary"
      aria-hidden="true"
    />
    <input
      v-model="text"
      type="text"
      role="combobox"
      :aria-label="label"
      :aria-expanded="items.length > 0"
      :aria-controls="listId"
      :aria-activedescendant="activeId"
      autocomplete="off"
      placeholder="#número o texto del asunto"
      class="min-h-[var(--control-min)] w-full rounded-[var(--radius-control)] border border-separator bg-surface pl-8 pr-2.5 outline-none placeholder:text-secondary focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
      @keydown="onKeydown"
    >
    <ul
      v-if="items.length > 0"
      :id="listId"
      role="listbox"
      :class="[FLOATING_PANEL, 'absolute inset-x-0 top-full mt-1 max-h-64 overflow-y-auto']"
    >
      <li
        v-for="(issue, i) in items"
        :id="`${listId}-${issue.id}`"
        :key="issue.id"
        role="option"
        :aria-selected="i === active"
        class="flex min-h-[var(--control-min)] cursor-default items-baseline gap-2 rounded-[var(--radius-control)] px-2 py-1 aria-selected:bg-fill-selected"
        @mousedown.prevent="choose(issue)"
        @mousemove="active = i"
      >
        <span class="data shrink-0 text-secondary">#{{ issue.id }}</span>
        <span class="truncate">{{ issue.subject }}</span>
      </li>
    </ul>
    <p
      v-else-if="search && results.isSuccess.value && !results.isFetching.value"
      class="absolute inset-x-0 top-full z-50 mt-1 rounded-[var(--radius-surface)] border border-separator bg-raised px-3 py-2 text-[length:var(--text-caption)] text-secondary shadow-popover"
    >
      Ninguna tarea coincide.
    </p>
  </div>
</template>
