<script setup lang="ts">
import type { Board } from '../../../shared/workspace/model'
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuSeparator, DropdownMenuTrigger } from 'reka-ui'
import { projectCode } from '../../../shared/redmine/issue-display'
import { boardProjectIds } from '../../../shared/workspace/model'

/**
 * Un board del workspace (F2c-T05): panel de salidas con las tareas asignadas a mí
 * de un proyecto, una categoría o una lista suelta, ordenadas por prioridad y
 * fecha fin. La cabecera es el asa para moverlo (`.board-handle`).
 */
const props = defineProps<{
  board: Board
  /** Con el candado cerrado se puede cambiar el ancho en la rejilla. */
  locked: boolean
}>()

const emit = defineEmits<{ addIssues: [] }>()

const workspace = useWorkspaceStore()
const session = useSessionStore()
const toasts = useToastStore()
const flow = useCardFlow()

const { issues, isPending, error, refetch, empty } = useBoardIssues(() => props.board)

const inProgress = computed(() => issues.value.filter(issue => flow.stage(issue) === 'in_progress').length)
const summary = computed(() => {
  const count = issues.value.length === 1 ? '1 tarea' : `${issues.value.length} tareas`
  return inProgress.value > 0 ? `${count} · ${inProgress.value} en curso` : count
})

/** Código de 3 letras: el del proyecto si es uno, si no el del título. */
const code = computed(() => {
  const ids = boardProjectIds(props.board, workspace.categories)
  if (props.board.kind === 'project' && ids.length === 1) {
    const project = session.catalogs.projects.find(p => p.id === ids[0])
    if (project) return projectCode(project.name)
  }
  return projectCode(props.board.title)
})

const KIND_ICON = { project: 'lucide:folder', category: 'lucide:folders', custom: 'lucide:list-checks' } as const

const renaming = ref(false)
const draft = ref('')
const renameInput = ref<HTMLInputElement | null>(null)
function startRename(): void {
  draft.value = props.board.title
  renaming.value = true
  nextTick(() => renameInput.value?.select())
}
function commitRename(): void {
  const title = draft.value.trim()
  if (title && title !== props.board.title) workspace.patchBoard(props.board.id, { title })
  renaming.value = false
}

function remove(): void {
  const undo = workspace.deleteBoard(props.board.id)
  toasts.show(`Board "${props.board.title}" quitado`, { label: 'Deshacer', run: undo })
}
</script>

<template>
  <section
    class="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-surface)] border border-separator bg-raised shadow-panel"
    :aria-labelledby="`board-title-${board.id}`"
    :data-board="board.id"
  >
    <header
      class="board-handle flex min-h-12 shrink-0 items-center gap-2 pl-4 pr-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      tabindex="0"
      :aria-describedby="`board-move-${board.id}`"
    >
      <span
        :id="`board-move-${board.id}`"
        class="sr-only"
      >Usa las flechas para mover el board.</span>
      <UiPlate
        :name="board.title"
        :code="code"
      />
      <form
        v-if="renaming"
        class="min-w-0 flex-1"
        @submit.prevent="commitRename"
      >
        <input
          ref="renameInput"
          v-model="draft"
          aria-label="Nombre del board"
          maxlength="80"
          class="w-full rounded-[var(--radius-plate)] border border-separator bg-surface px-1.5 py-0.5 text-[length:var(--text-body)] font-semibold"
          @blur="commitRename"
          @keydown.esc="renaming = false"
        >
      </form>
      <h2
        v-else
        :id="`board-title-${board.id}`"
        class="min-w-0 truncate text-[15px] font-semibold"
        @dblclick="startRename"
      >
        {{ board.title }}
      </h2>
      <Icon
        :name="KIND_ICON[board.kind]"
        class="size-3.5 shrink-0 text-tertiary"
        aria-hidden="true"
      />
      <span class="data ml-auto shrink-0 text-[length:var(--text-caption)] text-secondary">{{ summary }}</span>

      <UiButton
        :label="`Abrir ${board.title} como kanban`"
        icon="lucide:square-kanban"
        icon-only
        variant="ghost"
        :to="`/board/${board.id}/kanban`"
      />
      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <UiButton
            :label="`Opciones de ${board.title}`"
            icon="lucide:ellipsis"
            icon-only
            variant="ghost"
          />
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent
            :class="[FLOATING_PANEL, 'min-w-52']"
            align="end"
            :side-offset="6"
          >
            <DropdownMenuItem
              v-if="board.kind === 'custom'"
              :class="MENU_ITEM"
              @select="emit('addIssues')"
            >
              <Icon
                name="lucide:list-plus"
                class="size-4 text-secondary"
                aria-hidden="true"
              />
              Añadir tareas
            </DropdownMenuItem>
            <DropdownMenuItem
              :class="MENU_ITEM"
              @select="startRename"
            >
              <Icon
                name="lucide:pencil"
                class="size-4 text-secondary"
                aria-hidden="true"
              />
              Renombrar
            </DropdownMenuItem>
            <DropdownMenuItem
              v-if="locked"
              :class="MENU_ITEM"
              @select="workspace.patchBoard(board.id, { span: board.span === 2 ? 1 : 2 })"
            >
              <Icon
                :name="board.span === 2 ? 'lucide:shrink' : 'lucide:expand'"
                class="size-4 text-secondary"
                aria-hidden="true"
              />
              {{ board.span === 2 ? 'Ocupar una columna' : 'Ocupar dos columnas' }}
            </DropdownMenuItem>
            <DropdownMenuItem
              :class="MENU_ITEM"
              @select="navigateTo(`/board/${board.id}/kanban`)"
            >
              <Icon
                name="lucide:square-kanban"
                class="size-4 text-secondary"
                aria-hidden="true"
              />
              Abrir como kanban
            </DropdownMenuItem>
            <DropdownMenuSeparator :class="MENU_SEPARATOR" />
            <DropdownMenuItem
              :class="MENU_ITEM"
              @select="remove"
            >
              <Icon
                name="lucide:trash-2"
                class="size-4 text-secondary"
                aria-hidden="true"
              />
              Quitar board
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </header>

    <div class="board-rows flex min-h-0 flex-1 flex-col">
      <div
        class="board-row grid shrink-0 items-center border-y border-separator py-1.5 pr-2"
        aria-hidden="true"
      >
        <span class="panel-label pl-4">#</span>
        <span class="panel-label">Tarea</span>
        <span class="panel-label">Vence</span>
        <span class="panel-label board-priority">Prioridad</span>
        <span class="panel-label">Estado</span>
        <span />
      </div>

      <div
        v-if="isPending && !empty"
        aria-busy="true"
        :aria-label="`Cargando ${board.title}`"
      >
        <div
          v-for="n in 4"
          :key="n"
          class="flex h-[var(--row-height)] items-center gap-4 px-4 even:bg-fill-alt"
        >
          <span class="h-3 w-10 rounded-[var(--radius-plate)] bg-fill-selected motion-safe:animate-pulse" />
          <span
            class="h-3 rounded-[var(--radius-plate)] bg-fill-selected motion-safe:animate-pulse"
            :style="{ width: `${30 + ((n * 23) % 40)}%` }"
          />
        </div>
      </div>

      <div
        v-else-if="error"
        role="alert"
        class="flex flex-col items-center gap-2 px-4 py-6 text-center"
      >
        <p class="text-secondary">
          No se pudieron cargar las tareas de este board.
        </p>
        <UiButton
          label="Reintentar"
          icon="lucide:rotate-cw"
          @click="refetch()"
        />
      </div>

      <div
        v-else-if="empty"
        class="flex flex-col items-center gap-2 px-4 py-6 text-center"
      >
        <p class="text-secondary">
          {{ board.kind === 'custom' ? 'Esta lista aún no tiene tareas.' : 'Este board no tiene proyectos.' }}
        </p>
        <UiButton
          v-if="board.kind === 'custom'"
          label="Añadir tareas"
          icon="lucide:list-plus"
          @click="emit('addIssues')"
        />
      </div>

      <p
        v-else-if="issues.length === 0"
        class="flex items-center justify-center gap-2 px-4 py-6 text-secondary"
      >
        <Icon
          name="lucide:plane-landing"
          class="size-4 text-tertiary"
          aria-hidden="true"
        />
        Nada pendiente aquí. Todo ha salido.
      </p>

      <TransitionGroup
        v-else
        tag="ul"
        name="rerank"
        class="relative max-h-[30rem] overflow-y-auto pb-1"
        :aria-label="`Tareas de ${board.title}`"
      >
        <IssuesIssueCard
          v-for="(issue, index) in issues"
          :key="issue.id"
          :issue="issue"
          :alternate="index % 2 === 1"
          :board-id="board.kind === 'custom' ? board.id : undefined"
        />
      </TransitionGroup>
    </div>
  </section>
</template>
