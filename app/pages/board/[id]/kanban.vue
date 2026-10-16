<script setup lang="ts">
import type { KanbanMode } from '../../../../shared/kanban/group'
import { isKanbanMode } from '../../../../shared/kanban/group'

/**
 * Kanban de un board del workspace (F2d-T03). El modo vive en la URL (`?by=`), así
 * que se comparte y atrás/adelante lo recorre.
 */
definePageMeta({ title: 'Kanban' })

const route = useRoute()
const router = useRouter()
const workspace = useWorkspaceStore()

const board = computed(() => workspace.boards.find(b => b.id === route.params.id))

const mode = computed<KanbanMode>(() => isKanbanMode(route.query.by) ? route.query.by : 'status')
function setMode(next: KanbanMode): void {
  router.push({ query: { ...route.query, by: next === 'status' ? undefined : next } })
}

const MODES = [
  { value: 'status', label: 'Estado', icon: 'lucide:columns-3' },
  { value: 'sprint', label: 'Sprint', icon: 'lucide:flag' },
  { value: 'matrix', label: 'Estado / Sprint', icon: 'lucide:grid-3x3' },
] as const

const pageTitle = useState<string | null>('page-title')
watchEffect(() => {
  pageTitle.value = board.value ? board.value.title : null
})
onBeforeUnmount(() => {
  pageTitle.value = null
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <Teleport
      defer
      to="#toolbar-actions"
    >
      <UiButton
        label="Volver al Workspace"
        icon="lucide:arrow-left"
        icon-only
        variant="ghost"
        to="/"
      />
      <UiSegmentedControl
        v-if="board"
        :model-value="mode"
        label="Agrupar por"
        :options="MODES"
        class="ml-2 hidden wide:inline-flex"
        @update:model-value="setMode"
      />
    </Teleport>

    <UiSegmentedControl
      v-if="board"
      :model-value="mode"
      label="Agrupar por"
      :options="MODES"
      class="mx-3 mb-3 self-start wide:hidden"
      @update:model-value="setMode"
    />

    <KanbanKanbanView
      v-if="board"
      :board="board"
      :mode="mode"
    />

    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center gap-3 text-center"
    >
      <p class="text-secondary">
        Este board ya no existe en tu workspace.
      </p>
      <UiButton
        label="Ir al Workspace"
        to="/"
      />
    </div>
  </div>
</template>
