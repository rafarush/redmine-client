<script setup lang="ts">
import type { BoardKind } from '../../../shared/workspace/model'
import { ListboxContent, ListboxFilter, ListboxItem, ListboxRoot } from 'reka-ui'
import { projectCode } from '../../../shared/redmine/issue-display'
import { normalize } from '../../../shared/redmine/palette'

/**
 * Añadir un board (F2c-T05): de un proyecto, de una categoría (varios proyectos
 * agrupados con un nombre) o una lista de tareas sueltas por número. Siempre
 * muestra solo las tareas asignadas a mí.
 */
const open = defineModel<boolean>('open', { default: false })

const session = useSessionStore()
const workspace = useWorkspaceStore()
const toasts = useToastStore()

const kind = ref<BoardKind>('project')
const KINDS = [
  { value: 'project', label: 'Proyecto', icon: 'lucide:folder' },
  { value: 'category', label: 'Categoría', icon: 'lucide:folders' },
  { value: 'custom', label: 'Lista', icon: 'lucide:list-checks' },
] as const

const search = ref('')
const projects = computed(() => {
  const needle = normalize(search.value.trim())
  const list = [...session.catalogs.projects].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return needle ? list.filter(p => normalize(p.name).includes(needle)) : list
})

const selected = ref<number[]>([])
const name = ref('')
const issueText = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  search.value = ''
  selected.value = []
  name.value = ''
  issueText.value = ''
})
watch(kind, () => {
  selected.value = []
})

/** "4821, #4790 4800" → [4821, 4790, 4800]. */
const issueIds = computed(() => [...new Set((issueText.value.match(/\d+/g) ?? []).map(Number).filter(n => n > 0))])

const canCreate = computed(() => {
  if (kind.value === 'project') return selected.value.length === 1
  if (kind.value === 'category') return selected.value.length > 0 && name.value.trim() !== ''
  return issueIds.value.length > 0
})

function create(): void {
  if (!canCreate.value) return
  if (kind.value === 'project') {
    const project = session.catalogs.projects.find(p => p.id === selected.value[0])!
    workspace.addBoard({ kind: 'project', title: project.name, projectIds: [project.id] })
  }
  else if (kind.value === 'category') {
    const id = crypto.randomUUID()
    workspace.upsertCategory({ id, name: name.value.trim(), projectIds: [...selected.value] })
    workspace.addBoard({ kind: 'category', title: name.value.trim(), categoryId: id })
  }
  else {
    workspace.addBoard({ kind: 'custom', title: name.value.trim() || 'Mi lista', issueIds: issueIds.value })
  }
  toasts.show('Board añadido')
  open.value = false
}

function onListboxUpdate(value: unknown): void {
  const values = (Array.isArray(value) ? value : [value]).filter((v): v is number => typeof v === 'number')
  selected.value = kind.value === 'project' ? values.slice(-1) : values
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Añadir board"
    description="Verás solo las tareas abiertas asignadas a ti."
    :width="28"
  >
    <form
      class="flex flex-col gap-4"
      @submit.prevent="create"
    >
      <UiSegmentedControl
        v-model="kind"
        label="Tipo de board"
        :options="KINDS"
      />

      <label
        v-if="kind !== 'project'"
        class="flex flex-col gap-1"
      >
        <span class="panel-label">{{ kind === 'category' ? 'Nombre de la categoría' : 'Nombre de la lista' }}</span>
        <input
          v-model="name"
          type="text"
          maxlength="60"
          :placeholder="kind === 'category' ? 'Clientes' : 'Esta semana'"
          class="min-h-[var(--control-min)] rounded-[var(--radius-control)] border border-separator bg-surface px-2.5"
        >
      </label>

      <label
        v-if="kind === 'custom'"
        class="flex flex-col gap-1"
      >
        <span class="panel-label">Números de tarea</span>
        <input
          v-model="issueText"
          type="text"
          inputmode="numeric"
          placeholder="4821, 4790, 4802"
          class="data min-h-[var(--control-min)] rounded-[var(--radius-control)] border border-separator bg-surface px-2.5"
        >
        <span class="text-[length:var(--text-caption)] text-secondary">
          {{ issueIds.length === 0 ? 'Separa los números con comas o espacios.' : issueIds.length === 1 ? '1 tarea' : `${issueIds.length} tareas` }}
        </span>
      </label>

      <div
        v-else
        class="flex flex-col gap-1"
      >
        <span class="panel-label">{{ kind === 'project' ? 'Proyecto' : 'Proyectos de la categoría' }}</span>
        <ListboxRoot
          :multiple="kind === 'category'"
          :model-value="kind === 'project' ? selected[0] : selected"
          class="overflow-hidden rounded-[var(--radius-control)] border border-separator"
          @update:model-value="onListboxUpdate"
        >
          <ListboxFilter
            v-model="search"
            placeholder="Buscar proyecto…"
            aria-label="Buscar proyecto"
            class="w-full border-b border-separator bg-surface px-2.5 py-2"
          />
          <ListboxContent class="max-h-56 overflow-y-auto p-1">
            <ListboxItem
              v-for="project in projects"
              :key="project.id"
              :value="project.id"
              class="flex min-h-[var(--control-min)] cursor-pointer items-center gap-2 rounded-[var(--radius-plate)] px-2 data-[highlighted]:bg-fill-hover data-[state=checked]:bg-fill-selected data-[state=checked]:font-semibold"
            >
              <UiPlate
                :name="project.name"
                :code="projectCode(project.name)"
              />
              <span class="min-w-0 flex-1 truncate">{{ project.name }}</span>
              <Icon
                v-if="selected.includes(project.id)"
                name="lucide:check"
                class="size-4 shrink-0"
                aria-hidden="true"
              />
            </ListboxItem>
            <p
              v-if="projects.length === 0"
              class="px-2 py-3 text-secondary"
            >
              Ningún proyecto coincide.
            </p>
          </ListboxContent>
        </ListboxRoot>
      </div>
    </form>

    <template #footer>
      <UiButton
        label="Cancelar"
        variant="ghost"
        @click="open = false"
      />
      <UiButton
        label="Añadir board"
        variant="primary"
        :disabled="!canCreate"
        @click="create"
      />
    </template>
  </UiDialog>
</template>
