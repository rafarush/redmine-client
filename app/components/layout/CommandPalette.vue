<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { toUrl } from '../../../shared/redmine/filters'
import { filterByName, filterCommands, parseSearch } from '../../../shared/redmine/palette'

/**
 * Búsqueda global (F2-T07): `Ctrl/⌘+K`. Tareas por `#id` o asunto, proyectos por
 * nombre y comandos, todo en un solo sitio (`searching.md › Best practices`).
 * El foco se queda en el campo y la lista se maneja con `aria-activedescendant`.
 */
const ui = useUiStore()
const session = useSessionStore()
const redmine = useRedmine()
const router = useRouter()

type Group = 'Tareas' | 'Proyectos' | 'Comandos' | 'Recientes'

interface Row {
  key: string
  group: Group
  label: string
  detail?: string
  icon: string
  run: () => void
}

const input = ref('')
const debounced = ref('')
const active = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)

let timer: ReturnType<typeof setTimeout> | undefined
watch(input, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => (debounced.value = value), 200)
  active.value = 0
})
onBeforeUnmount(() => clearTimeout(timer))

watch(() => ui.paletteOpen, (open) => {
  if (open) {
    input.value = ''
    debounced.value = ''
    active.value = 0
  }
})

const parsed = computed(() => parseSearch(input.value))
const remote = computed(() => parseSearch(debounced.value))

const issueResults = useQuery({
  queryKey: computed(() => ['palette-issues', remote.value]),
  queryFn: async () => {
    const search = remote.value
    if (search.kind !== 'text') return []
    const page = await redmine.listIssues({ subject: `~${search.text}`, status_id: '*', limit: 8, sort: 'updated_on:desc' })
    return page.items
  },
  enabled: computed(() => ui.paletteOpen && remote.value.kind === 'text'),
  staleTime: 30_000,
})

const issueById = useQuery({
  queryKey: computed(() => ['palette-issue', remote.value.kind === 'issue-id' ? remote.value.id : 0]),
  queryFn: () => redmine.getIssue((remote.value as { id: number }).id, ''),
  enabled: computed(() => ui.paletteOpen && remote.value.kind === 'issue-id'),
  retry: false,
  staleTime: 30_000,
})

function close(): void {
  ui.paletteOpen = false
}

/** La ficha de tarea llega con F3; hasta entonces se abre en Redmine. */
function openIssue(id: number): void {
  window.open(`${session.url.replace(/\/$/, '')}/issues/${id}`, '_blank', 'noopener')
}

function reuse(text: string): void {
  input.value = text
  nextTick(() => inputEl.value?.focus())
}

function choose(row: Row): void {
  const text = input.value.trim()
  const keepsHistory = row.group === 'Tareas' || row.group === 'Proyectos'
  if (text && keepsHistory) ui.rememberSearch(text)
  // Una búsqueda reciente vuelve al campo en vez de cerrar la paleta.
  if (row.group !== 'Recientes') close()
  row.run()
}

const rows = computed<Row[]>(() => {
  const result: Row[] = []
  const search = parsed.value

  if (search.kind === 'empty') {
    for (const text of ui.recentSearches) {
      result.push({ key: `recent-${text}`, group: 'Recientes', label: text, icon: 'lucide:history', run: () => reuse(text) })
    }
  }

  if (search.kind === 'issue-id') {
    const found = issueById.data.value
    result.push({
      key: `issue-${search.id}`,
      group: 'Tareas',
      label: found?.subject ? `#${search.id} ${found.subject}` : `Abrir tarea #${search.id}`,
      detail: found?.project?.name,
      icon: 'lucide:ticket',
      run: () => openIssue(search.id),
    })
  }

  if (search.kind === 'text') {
    for (const issue of issueResults.data.value ?? []) {
      result.push({
        key: `issue-${issue.id}`,
        group: 'Tareas',
        label: `#${issue.id} ${issue.subject}`,
        detail: issue.project?.name,
        icon: 'lucide:ticket',
        run: () => openIssue(issue.id),
      })
    }
  }

  const query = search.kind === 'text' ? search.text : ''
  for (const project of filterByName(session.catalogs.projects, query, 5)) {
    const f = toUrl({ conditions: [{ field: 'project_id', operator: '=', values: [String(project.id)] }] })
    result.push({
      key: `project-${project.id}`,
      group: 'Proyectos',
      label: project.name,
      icon: 'lucide:folder-kanban',
      run: () => router.push({ path: '/', query: { f } }),
    })
  }

  for (const command of filterCommands(query)) {
    result.push({ key: command.id, group: 'Comandos', label: command.label, icon: command.icon, run: () => router.push(command.to) })
  }

  return result
})

const loading = computed(() => (issueResults.isFetching.value || issueById.isFetching.value) && parsed.value.kind !== 'empty')

const grouped = computed(() => {
  const groups: { name: Group, items: { row: Row, index: number }[] }[] = []
  rows.value.forEach((row, index) => {
    let group = groups.find(g => g.name === row.group)
    if (!group) {
      group = { name: row.group, items: [] }
      groups.push(group)
    }
    group.items.push({ row, index })
  })
  return groups
})

watch(rows, () => {
  if (active.value >= rows.value.length) active.value = Math.max(0, rows.value.length - 1)
})

function onKeydown(event: KeyboardEvent): void {
  const count = rows.value.length
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    active.value = count ? (active.value + 1) % count : 0
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault()
    active.value = count ? (active.value - 1 + count) % count : 0
  }
  else if (event.key === 'Enter') {
    event.preventDefault()
    const row = rows.value[active.value]
    if (row) choose(row)
  }
}

watch(active, () => nextTick(() => document.getElementById(`palette-row-${active.value}`)?.scrollIntoView({ block: 'nearest' })))

/** Lo que anuncia el lector de pantalla al cambiar los resultados. */
const status = computed(() => {
  if (loading.value) return 'Buscando…'
  return rows.value.length === 0 ? 'Sin resultados' : `${rows.value.length} resultados`
})
</script>

<template>
  <DialogRoot v-model:open="ui.paletteOpen">
    <DialogPortal>
      <DialogOverlay class="ui-scrim fixed inset-0 z-40 bg-scrim" />
      <DialogContent
        class="fixed left-1/2 top-[12vh] ui-dialog z-50 flex max-h-[70vh] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-[var(--radius-surface)] border border-separator bg-raised shadow-dialog"
        @open-auto-focus.prevent="inputEl?.focus()"
      >
        <DialogTitle class="sr-only">
          Buscar
        </DialogTitle>
        <DialogDescription class="sr-only">
          Busca tareas por número o asunto, proyectos y comandos. Usa las flechas para moverte y Intro para elegir.
        </DialogDescription>

        <div class="flex items-center gap-2 border-b border-separator px-3">
          <Icon
            name="lucide:search"
            class="size-4 shrink-0 text-secondary"
            aria-hidden="true"
          />
          <input
            ref="inputEl"
            v-model="input"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            :aria-activedescendant="rows.length ? `palette-row-${active}` : undefined"
            aria-label="Buscar"
            placeholder="Buscar tareas (#número o asunto), proyectos y comandos"
            autocomplete="off"
            spellcheck="false"
            class="min-h-11 flex-1 bg-transparent text-[length:var(--text-body)] text-content placeholder:text-secondary focus:outline-none"
            @keydown="onKeydown"
          >
        </div>

        <div
          id="palette-list"
          role="listbox"
          aria-label="Resultados"
          class="min-h-0 flex-1 overflow-y-auto p-1"
        >
          <p
            v-if="rows.length === 0"
            class="px-3 py-6 text-center text-[length:var(--text-body)] text-secondary"
          >
            {{ loading ? 'Buscando…' : 'Sin resultados. Prueba con otro asunto o con el número de la tarea.' }}
          </p>

          <template
            v-for="group in grouped"
            :key="group.name"
          >
            <div class="flex items-center justify-between px-2 pb-0.5 pt-2">
              <span
                class="text-[length:var(--text-caption)] font-medium text-secondary"
                aria-hidden="true"
              >{{ group.name }}</span>
              <button
                v-if="group.name === 'Recientes'"
                type="button"
                class="rounded px-1 text-[length:var(--text-caption)] text-secondary hover:text-content"
                @click="ui.clearRecentSearches()"
              >
                Borrar búsquedas recientes
              </button>
            </div>
            <div
              v-for="{ row, index } in group.items"
              :id="`palette-row-${index}`"
              :key="row.key"
              role="option"
              :aria-selected="index === active"
              class="flex min-h-[var(--control-min)] cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-2 text-[length:var(--text-body)] text-content aria-selected:bg-surface"
              @mousemove="active = index"
              @click="choose(row)"
            >
              <Icon
                :name="row.icon"
                class="size-4 shrink-0 text-secondary"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1 truncate">{{ row.label }}</span>
              <span
                v-if="row.detail"
                class="max-w-40 shrink-0 truncate text-[length:var(--text-caption)] text-secondary"
              >{{ row.detail }}</span>
            </div>
          </template>
        </div>

        <p
          class="sr-only"
          role="status"
        >
          {{ status }}
        </p>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
