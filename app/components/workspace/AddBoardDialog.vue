<script setup lang="ts">
import type { BoardKind } from '../../../shared/workspace/model'
import { ListboxContent, ListboxFilter, ListboxItem, ListboxRoot } from 'reka-ui'
import { projectCode } from '../../../shared/redmine/issue-display'
import { normalize } from '../../../shared/redmine/palette'

/**
 * Añadir un board (F2c-T05): de un proyecto, de una o varias categorías de tareas
 * de Redmine de un proyecto, o una lista de tareas sueltas que se buscan y marcan.
 * Proyecto y categoría muestran solo las tareas asignadas a mí; la lista, las elegidas.
 * Con `targetBoardId` solo se muestra el selector para añadir tareas a esa lista.
 */
const open = defineModel<boolean>('open', { default: false })
/** Con una lista como destino, el diálogo solo le añade tareas (menú "…" del board). */
const props = defineProps<{ targetBoardId?: string }>()

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
const categoryIds = ref<number[]>([])
const projectId = computed(() => kind.value === 'category' ? selected.value[0] : undefined)
const { data: projectDetail, isPending: loadingCategories } = useProjectDetail(projectId)
const categoryOptions = computed(() =>
  [...(projectDetail.value?.issue_categories ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es')))
const name = ref('')
const issueIds = ref<number[]>([])
const target = computed(() => workspace.boards.find(b => b.id === props.targetBoardId && b.kind === 'custom'))

watch(open, (isOpen) => {
  if (!isOpen) return
  search.value = ''
  selected.value = []
  categoryIds.value = []
  name.value = ''
  issueIds.value = []
  kind.value = target.value ? 'custom' : 'project'
})
watch(kind, () => {
  selected.value = []
  categoryIds.value = []
})
watch(selected, () => {
  categoryIds.value = []
})

const canCreate = computed(() => {
  if (kind.value === 'project') return selected.value.length === 1
  if (kind.value === 'category') return selected.value.length === 1 && categoryIds.value.length > 0
  return issueIds.value.length > 0
})

function create(): void {
  if (!canCreate.value) return
  if (target.value) {
    workspace.addIssues(target.value.id, issueIds.value)
    toasts.show(issueIds.value.length === 1 ? 'Tarea añadida' : 'Tareas añadidas')
    open.value = false
    return
  }
  if (kind.value === 'project') {
    const project = session.catalogs.projects.find(p => p.id === selected.value[0])!
    workspace.addBoard({ kind: 'project', title: project.name, projectIds: [project.id] })
  }
  else if (kind.value === 'category') {
    const project = session.catalogs.projects.find(p => p.id === selected.value[0])!
    const names = categoryOptions.value.filter(c => categoryIds.value.includes(c.id)).map(c => c.name)
    workspace.addBoard({
      kind: 'category',
      title: name.value.trim() || `${project.name} · ${names.join(', ')}`,
      projectIds: [project.id],
      issueCategoryIds: [...categoryIds.value],
    })
  }
  else {
    workspace.addBoard({ kind: 'custom', title: name.value.trim() || 'Mi lista', issueIds: issueIds.value })
  }
  toasts.show('Board añadido')
  open.value = false
}

function onListboxUpdate(value: unknown): void {
  const values = (Array.isArray(value) ? value : [value]).filter((v): v is number => typeof v === 'number')
  selected.value = values.slice(-1)
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    :title="target ? `Añadir tareas a ${target.title}` : 'Añadir board'"
    :description="target ? 'Verás las tareas abiertas que elijas, sean de quien sean.' : kind === 'custom' ? 'Una lista muestra las tareas abiertas que elijas, sean de quien sean.' : 'Verás solo las tareas abiertas asignadas a ti.'"
    :width="28"
  >
    <form
      class="flex flex-col gap-4"
      @submit.prevent="create"
    >
      <UiSegmentedControl
        v-if="!target"
        v-model="kind"
        label="Tipo de board"
        :options="KINDS"
      />

      <label
        v-if="!target && kind !== 'project'"
        class="flex flex-col gap-1"
      >
        <span class="panel-label">{{ kind === 'category' ? 'Nombre del board (opcional)' : 'Nombre de la lista' }}</span>
        <input
          v-model="name"
          type="text"
          maxlength="60"
          :placeholder="kind === 'category' ? 'Se arma con las categorías' : 'Esta semana'"
          class="min-h-[var(--control-min)] rounded-[var(--radius-control)] border border-separator bg-surface px-2.5"
        >
      </label>

      <WorkspaceIssueMultiPicker
        v-if="kind === 'custom'"
        v-model="issueIds"
        :exclude="target?.issueIds"
      />

      <div
        v-else
        class="flex flex-col gap-1"
      >
        <span class="panel-label">Proyecto</span>
        <ListboxRoot
          :model-value="selected[0]"
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

      <div
        v-if="kind === 'category' && selected.length === 1"
        class="flex flex-col gap-1"
      >
        <span class="panel-label">Categorías de tareas</span>
        <p
          v-if="loadingCategories"
          class="text-secondary"
        >
          Cargando categorías…
        </p>
        <p
          v-else-if="categoryOptions.length === 0"
          class="text-secondary"
        >
          Este proyecto no tiene categorías de tareas.
        </p>
        <ListboxRoot
          v-else
          v-model="categoryIds"
          multiple
          class="overflow-hidden rounded-[var(--radius-control)] border border-separator"
        >
          <ListboxContent
            class="max-h-40 overflow-y-auto p-1"
            aria-label="Categorías de tareas"
          >
            <ListboxItem
              v-for="category in categoryOptions"
              :key="category.id"
              :value="category.id"
              class="flex min-h-[var(--control-min)] cursor-pointer items-center gap-2 rounded-[var(--radius-plate)] px-2 data-[highlighted]:bg-fill-hover data-[state=checked]:bg-fill-selected data-[state=checked]:font-semibold"
            >
              <span class="min-w-0 flex-1 truncate">{{ category.name }}</span>
              <Icon
                v-if="categoryIds.includes(category.id)"
                name="lucide:check"
                class="size-4 shrink-0"
                aria-hidden="true"
              />
            </ListboxItem>
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
        :label="target ? 'Añadir tareas' : 'Añadir board'"
        variant="primary"
        :disabled="!canCreate"
        @click="create"
      />
    </template>
  </UiDialog>
</template>
