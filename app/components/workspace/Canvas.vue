<script setup lang="ts">
import type { Board } from '../../../shared/workspace/model'
import { VueDraggable } from 'vue-draggable-plus'
import { projectCode } from '../../../shared/redmine/issue-display'
import { guessStatusMap } from '../../../shared/workspace/flow'

/**
 * El Workspace (F2c-T07). Con el candado cerrado, los boards encajan en una
 * rejilla de dos columnas y se reordenan arrastrando la cabecera; abierto, cada
 * board se coloca libre en un lienzo con la rejilla de construcción a la vista.
 * Las dos disposiciones se guardan: abrir y cerrar el candado no pierde ninguna.
 * Con teclado: foco en la cabecera de un board y flechas.
 */
const workspace = useWorkspaceStore()
const session = useSessionStore()
const flow = useCardFlow()

const addOpen = ref(false)
/** Lista a la que se añaden tareas; sin ella, el diálogo crea un board nuevo. */
const addTarget = ref<string | undefined>()
function openAddIssues(board: Board): void {
  addTarget.value = board.id
  addOpen.value = true
}
function openAddBoard(): void {
  addTarget.value = undefined
  addOpen.value = true
}
const locked = computed(() => workspace.workspace.locked)

// En compacto todo es una columna y no se arrastra.
const compact = ref(false)
let media: MediaQueryList | undefined
const syncMedia = () => {
  compact.value = !!media?.matches
}
onMounted(() => {
  media = window.matchMedia('(max-width: 899px)')
  syncMedia()
  media.addEventListener('change', syncMedia)
})
onBeforeUnmount(() => media?.removeEventListener('change', syncMedia))

// Atajos del workspace (personalizables en ajustes). Solo existen mientras está en pantalla.
const shortcuts = useShortcutsStore()
useShortcut('addBoard', openAddBoard)
useShortcut('toggleGrid', () => {
  if (workspace.boards.length > 0 && !compact.value) workspace.setLocked(!locked.value)
})

// Primera vez: se propone el mapeo de estados por nombre (se cambia en Ajustes).
watchEffect(() => {
  const map = workspace.workspace.statusMap
  const statuses = session.catalogs.statuses
  if (statuses.length > 0 && map.inProgress === undefined && map.done === undefined && map.rtqa === undefined) {
    const guessed = guessStatusMap(statuses)
    if (guessed.inProgress || guessed.done || guessed.rtqa) workspace.setStatusMap(guessed)
  }
})

// ------------------------------------------------------------------ rejilla

/** Copia local para Sortable; el orden se guarda al soltar. */
const ordered = ref<Board[]>([])
watch(() => workspace.boards, (boards) => {
  ordered.value = [...boards]
}, { immediate: true })

function onSortEnd(event: { oldIndex?: number, newIndex?: number }): void {
  const { oldIndex, newIndex } = event
  if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return
  const board = workspace.boards[oldIndex]
  if (board) workspace.reorderBoard(board.id, newIndex)
}

// ------------------------------------------------------------- lienzo libre

const SNAP = 8
const KEY_STEP = 24
const snap = (n: number) => Math.max(0, Math.round(n / SNAP) * SNAP)

/** Posición mientras se arrastra; al soltar se guarda en el store. */
const dragging = ref<{ id: string, x: number, y: number, startX: number, startY: number, originX: number, originY: number } | null>(null)

function position(board: Board): { x: number, y: number } {
  return dragging.value?.id === board.id ? dragging.value : board.free
}

function onPointerDown(board: Board, event: PointerEvent): void {
  if (locked.value || compact.value || event.button !== 0) return
  if ((event.target as HTMLElement).closest('button, a, input')) return
  if (!(event.target as HTMLElement).closest('.board-handle')) return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  dragging.value = { id: board.id, x: board.free.x, y: board.free.y, startX: event.clientX, startY: event.clientY, originX: board.free.x, originY: board.free.y }
}

function onPointerMove(event: PointerEvent): void {
  const drag = dragging.value
  if (!drag) return
  drag.x = snap(drag.originX + event.clientX - drag.startX)
  drag.y = snap(drag.originY + event.clientY - drag.startY)
}

function onPointerUp(board: Board): void {
  const drag = dragging.value
  if (!drag || drag.id !== board.id) return
  workspace.patchBoard(board.id, { free: { ...board.free, x: drag.x, y: drag.y } })
  dragging.value = null
}

const canvasSize = computed(() => {
  const boards = workspace.boards
  const width = Math.max(0, ...boards.map(b => b.free.x + b.free.w)) + 48
  const height = Math.max(0, ...boards.map(b => b.free.y)) + 640
  return { width: `${width}px`, height: `${height}px` }
})

// ------------------------------------------------------------------ teclado

const announcement = ref('')

/** Flechas con el foco en la cabecera de un board: lo mueve. */
function onHandleKeydown(board: Board, event: KeyboardEvent): void {
  if (event.target !== event.currentTarget) return
  const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
  if (!delta) return
  event.preventDefault()
  if (locked.value || compact.value) {
    const index = workspace.boards.findIndex(b => b.id === board.id)
    const step = delta[0] !== 0 ? delta[0]! : delta[1]!
    workspace.reorderBoard(board.id, index + step)
    announcement.value = `${board.title}: posición ${Math.min(Math.max(index + step, 0), workspace.boards.length - 1) + 1} de ${workspace.boards.length}`
  }
  else {
    const x = Math.max(0, board.free.x + delta[0]! * KEY_STEP)
    const y = Math.max(0, board.free.y + delta[1]! * KEY_STEP)
    workspace.patchBoard(board.id, { free: { ...board.free, x, y } })
    announcement.value = `${board.title} movido`
  }
  nextTick(() => document.querySelector<HTMLElement>(`[data-board="${board.id}"] .board-handle`)?.focus())
}

/** Sugerencias del vacío: los primeros proyectos visibles. */
const suggestions = computed(() => [...session.catalogs.projects].sort((a, b) => a.name.localeCompare(b.name, 'es')).slice(0, 4))
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 pb-6">
    <Teleport
      defer
      to="#toolbar-actions"
    >
      <UiButton
        v-if="workspace.boards.length > 0"
        :label="locked ? 'Desbloquear: colocar los boards libremente' : 'Bloquear: encajar los boards en la rejilla'"
        :icon="locked ? 'lucide:lock' : 'lucide:lock-open'"
        icon-only
        variant="ghost"
        :aria-pressed="locked"
        :shortcut="shortcuts.bindings.toggleGrid"
        class="hidden wide:inline-flex"
        @click="workspace.setLocked(!locked)"
      />
      <UiButton
        label="Ajustes del workspace"
        icon="lucide:sliders-horizontal"
        icon-only
        variant="ghost"
        @click="flow.settingsOpen.value = true"
      />
    </Teleport>
    <Teleport
      defer
      to="#toolbar-primary"
    >
      <UiTooltip
        text="Añadir board"
        :shortcut="shortcuts.bindings.addBoard"
      >
        <UiButton
          label="Añadir board"
          icon="lucide:plus"
          variant="primary"
          @click="openAddBoard"
        />
      </UiTooltip>
    </Teleport>

    <WorkspaceDepartureStrip />

    <!-- Vacío: el primer board a un clic. -->
    <div
      v-if="workspace.boards.length === 0"
      class="mx-3 flex flex-col items-center gap-4 rounded-[var(--radius-surface)] border border-dashed border-separator px-6 py-12 text-center wide:mx-6"
    >
      <Icon
        name="lucide:plane-takeoff"
        class="size-8 text-tertiary"
        aria-hidden="true"
      />
      <div>
        <p class="text-[length:var(--text-title)] font-semibold">
          Tu panel está vacío
        </p>
        <p class="mt-1 max-w-sm text-secondary">
          Añade un board por proyecto, elige categorías de tareas o arma una lista con las tareas que quieras. Solo verás las asignadas a ti.
        </p>
      </div>
      <div
        v-if="suggestions.length > 0"
        class="flex flex-wrap justify-center gap-2"
      >
        <button
          v-for="project in suggestions"
          :key="project.id"
          type="button"
          class="inline-flex min-h-[var(--control-min)] items-center gap-2 rounded-[var(--radius-control)] border border-separator bg-raised px-2.5 shadow-panel hover:bg-fill-hover"
          @click="workspace.addBoard({ kind: 'project', title: project.name, projectIds: [project.id] })"
        >
          <UiPlate
            :name="project.name"
            :code="projectCode(project.name)"
          />
          {{ project.name }}
        </button>
      </div>
      <UiButton
        label="Otro board…"
        variant="ghost"
        @click="openAddBoard"
      />
    </div>

    <!-- Candado cerrado (o compacto): rejilla reordenable. -->
    <VueDraggable
      v-else-if="locked || compact"
      v-model="ordered"
      :animation="220"
      :disabled="compact"
      handle=".board-handle"
      filter="button, a, input"
      :prevent-on-filter="false"
      ghost-class="opacity-40"
      :force-fallback="true"
      :fallback-on-body="true"
      class="grid grid-cols-1 items-start gap-4 px-3 wide:grid-cols-2 wide:px-6"
      @end="onSortEnd"
    >
      <WorkspaceBoard
        v-for="board in ordered"
        :key="board.id"
        :board="board"
        :locked="true"
        :class="board.span === 2 ? 'wide:col-span-2' : ''"
        @add-issues="openAddIssues(board)"
        @keydown.capture="($event: KeyboardEvent) => ($event.target as HTMLElement).classList.contains('board-handle') && onHandleKeydown(board, $event)"
      />
    </VueDraggable>

    <!-- Candado abierto: lienzo libre con la rejilla de construcción visible. -->
    <div
      v-else
      class="mx-6 overflow-auto rounded-[var(--radius-surface)] border border-separator"
    >
      <div
        class="workspace-canvas relative"
        :style="canvasSize"
      >
        <WorkspaceBoard
          v-for="board in workspace.boards"
          :key="board.id"
          :board="board"
          :locked="false"
          class="absolute touch-none [&_.board-handle]:cursor-grab"
          :class="dragging?.id === board.id ? 'z-20 shadow-dialog [&_.board-handle]:cursor-grabbing' : 'z-10'"
          :style="{ left: `${position(board).x}px`, top: `${position(board).y}px`, width: `${board.free.w}px` }"
          @add-issues="openAddIssues(board)"
          @pointerdown="onPointerDown(board, $event)"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp(board)"
          @pointercancel="dragging = null"
          @keydown.capture="($event: KeyboardEvent) => ($event.target as HTMLElement).classList.contains('board-handle') && onHandleKeydown(board, $event)"
        />
      </div>
    </div>

    <p
      class="sr-only"
      role="status"
    >
      {{ announcement }}
    </p>

    <WorkspaceAddBoardDialog
      v-model:open="addOpen"
      :target-board-id="addTarget"
    />
  </div>
</template>
