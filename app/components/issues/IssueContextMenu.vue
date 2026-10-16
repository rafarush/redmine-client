<script setup lang="ts">
import type { IssueChange } from '../../../shared/redmine/issue-actions'
import type { Ref } from '../../../shared/redmine/types'
import { useQuery } from '@tanstack/vue-query'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from 'reka-ui'
import { applyChange } from '../../../shared/redmine/issue-actions'
import { timerFor } from '../../../shared/workspace/flow'

/**
 * Menú contextual de una tarea, uno para toda la app (F2c-T10). Como el menú del
 * sistema: título de la tarea arriba, acciones agrupadas y su atajo a la derecha.
 * Se abre con clic derecho, la tecla Menú o Mayús+F10 sobre cualquier fila o
 * tarjeta, y con el botón "…" de la lista. Lo que el usuario no puede hacer no sale.
 */
const menu = useIssueMenu()
const flow = useCardFlow()
const redmine = useRedmine()
const session = useSessionStore()
const workspace = useWorkspaceStore()
const toasts = useToastStore()
const { change } = useIssueChange()
const agentQueue = useAgentQueue()

const issue = computed(() => menu.state.value?.issue ?? null)
const open = computed({
  get: () => menu.state.value !== null,
  set: (value: boolean) => {
    if (!value) menu.close()
  },
})

// Al cerrar, el foco vuelve a donde estaba (la fila), no al cuerpo de la página.
let returnFocus: HTMLElement | null = null
watch(open, (isOpen) => {
  if (isOpen) returnFocus = document.activeElement as HTMLElement | null
})
function restoreFocus(event: Event): void {
  event.preventDefault()
  returnFocus?.focus?.({ preventScroll: true })
  returnFocus = null
}

const boardId = computed(() => menu.state.value?.boardId)

function removeFromList(target: { id: number }): void {
  if (!boardId.value) return
  const undo = workspace.removeIssue(boardId.value, target.id)
  toasts.show(`#${target.id} quitada de la lista`, { label: 'Deshacer', run: undo })
}

const issueId = computed(() => issue.value?.id ?? 0)
const projectId = computed(() => issue.value?.project.id)

/** Estados que el workflow deja a este usuario, cargados al abrir el menú. */
const allowed = useQuery({
  queryKey: computed(() => ['issue-allowed-statuses', issueId.value]),
  queryFn: async () => (await redmine.getIssue(issueId.value, 'allowed_statuses')).allowed_statuses ?? [],
  enabled: computed(() => open.value && issueId.value > 0),
  staleTime: 60_000,
})
const members = useQuery({
  queryKey: computed(() => ['project-members', projectId.value]),
  queryFn: () => redmine.listProjectMembers(projectId.value!),
  enabled: computed(() => open.value && projectId.value !== undefined),
  staleTime: 5 * 60_000,
})
const versions = useQuery({
  queryKey: computed(() => ['versions', [projectId.value]]),
  queryFn: () => redmine.listVersions(projectId.value!),
  enabled: computed(() => open.value && projectId.value !== undefined),
  staleTime: 5 * 60_000,
})

/** Estados ofrecidos: los permitidos, con el actual marcado (no se ofrece como cambio). */
const statuses = computed(() => {
  const list = allowed.data.value ?? []
  return list.some(s => s.id === issue.value?.status.id) || !issue.value ? list : [issue.value.status, ...list]
})
const openVersions = computed(() => (versions.data.value ?? []).filter(v => v.status !== 'closed'))
const assignees = computed<Ref[]>(() => members.data.value ?? [])

const timer = computed(() => issue.value ? timerFor(workspace.timers, issue.value.id) : undefined)
const timerLabel = computed(() => !timer.value ? 'Iniciar cronómetro' : timer.value.paused ? 'Reanudar cronómetro' : 'Pausar cronómetro')
const timerIcon = computed(() => !timer.value || timer.value.paused ? 'lucide:play' : 'lucide:pause')
const logged = computed(() => issue.value ? workspace.loggedFor(issue.value.id) : undefined)

function apply(next: IssueChange, label: string): void {
  if (!issue.value) return
  const optimistic = applyChange(issue.value, next, {
    statuses: allowed.data.value ?? session.catalogs.statuses,
    priorities: session.catalogs.priorities,
    members: members.data.value ?? [],
    versions: versions.data.value ?? [],
  })
  change(issue.value, next, optimistic, label)
}

const issueUrl = computed(() => issue.value ? `${session.url.replace(/\/$/, '')}/issues/${issue.value.id}` : '')

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(issueUrl.value)
    toasts.show('Enlace copiado')
  }
  catch {
    toasts.show('No se pudo copiar el enlace')
  }
}

function openExternal(path = ''): void {
  window.open(`${issueUrl.value}${path}`, '_blank', 'noopener')
}

const ICON = 'size-4 shrink-0 text-secondary'
const CHEVRON = 'ml-auto size-4 text-tertiary'
const HINT = 'ml-auto pl-6 text-[length:var(--text-caption)] text-tertiary data'
</script>

<template>
  <DropdownMenuRoot v-model:open="open">
    <!-- Ancla invisible en el punto donde se pulsó. -->
    <DropdownMenuTrigger as-child>
      <span
        class="pointer-events-none fixed size-0"
        :style="{ left: `${menu.state.value?.x ?? 0}px`, top: `${menu.state.value?.y ?? 0}px` }"
        aria-hidden="true"
      />
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent
        :class="[FLOATING_PANEL, 'w-64']"
        align="start"
        :side-offset="2"
        :collision-padding="8"
        @close-auto-focus="restoreFocus"
      >
        <template v-if="issue">
          <div class="flex items-baseline gap-2 px-2 pb-1.5 pt-1.5">
            <span class="data shrink-0 text-[length:var(--text-caption)] text-secondary">#{{ issue.id }}</span>
            <span class="truncate text-[length:var(--text-caption)] font-semibold">{{ issue.subject }}</span>
          </div>
          <DropdownMenuSeparator :class="MENU_SEPARATOR" />

          <DropdownMenuItem
            :class="MENU_ITEM"
            @select="flow.openDetails(issue)"
          >
            <Icon
              name="lucide:panel-right-open"
              :class="ICON"
              aria-hidden="true"
            />
            Ver detalles
            <span :class="HINT">↵</span>
          </DropdownMenuItem>

          <!-- Cola de Agente (F11-T06): solo si hay agente configurado. -->
          <DropdownMenuItem
            v-if="agentQueue.runner.configured.value"
            :class="MENU_ITEM"
            @select="agentQueue.add(issue)"
          >
            <Icon
              name="lucide:bot"
              :class="ICON"
              aria-hidden="true"
            />
            Añadir a la cola del agente
          </DropdownMenuItem>

          <!-- Solo dentro de una lista personalizada del workspace; es estado local, sin permiso. -->
          <DropdownMenuItem
            v-if="boardId"
            :class="MENU_ITEM"
            @select="removeFromList(issue)"
          >
            <Icon
              name="lucide:list-minus"
              :class="ICON"
              aria-hidden="true"
            />
            Quitar de esta lista
          </DropdownMenuItem>

          <!-- Tiempo -->
          <Can
            permission="log_time"
            :project="issue.project.id"
          >
            <DropdownMenuSeparator :class="MENU_SEPARATOR" />
            <DropdownMenuItem
              :class="MENU_ITEM"
              @select="flow.toggleTimer(issue)"
            >
              <Icon
                :name="timerIcon"
                :class="ICON"
                aria-hidden="true"
              />
              {{ timerLabel }}
              <span
                v-if="timer"
                :class="HINT"
              >P</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              v-if="timer"
              :class="MENU_ITEM"
              @select="flow.stop(issue)"
            >
              <Icon
                name="lucide:square"
                :class="[ICON, 'fill-current']"
                aria-hidden="true"
              />
              Parar y registrar
              <span :class="HINT">S</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              :class="MENU_ITEM"
              @select="flow.logging.value = issue"
            >
              <Icon
                name="lucide:clock-plus"
                :class="ICON"
                aria-hidden="true"
              />
              Registrar tiempo…
            </DropdownMenuItem>
            <DropdownMenuItem
              v-if="logged"
              :class="MENU_ITEM"
              @select="flow.adjusting.value = issue"
            >
              <Icon
                name="lucide:timer-reset"
                :class="ICON"
                aria-hidden="true"
              />
              Ajustar el último registro…
              <span :class="HINT">T</span>
            </DropdownMenuItem>
          </Can>

          <!-- Cambios en Redmine -->
          <Can
            permission="edit_issues"
            :project="issue.project.id"
          >
            <DropdownMenuSeparator :class="MENU_SEPARATOR" />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger :class="MENU_ITEM">
                <Icon
                  name="lucide:circle-dot"
                  :class="ICON"
                  aria-hidden="true"
                />
                Cambiar estado
                <Icon
                  name="lucide:chevron-right"
                  :class="CHEVRON"
                  aria-hidden="true"
                />
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent
                  :class="[FLOATING_PANEL, 'min-w-48']"
                  :side-offset="4"
                >
                  <p
                    v-if="allowed.isLoading.value"
                    class="px-2 py-2 text-[length:var(--text-caption)] text-secondary"
                  >
                    Cargando estados…
                  </p>
                  <DropdownMenuItem
                    v-for="status in statuses"
                    :key="status.id"
                    :class="MENU_ITEM"
                    :disabled="status.id === issue.status.id"
                    @select="apply({ status_id: status.id }, 'Estado cambiado')"
                  >
                    <Icon
                      :name="status.id === issue.status.id ? 'lucide:check' : 'lucide:circle'"
                      :class="ICON"
                      aria-hidden="true"
                    />
                    {{ status.name }}
                  </DropdownMenuItem>
                  <p
                    v-if="!allowed.isLoading.value && statuses.length <= 1"
                    class="px-2 py-2 text-[length:var(--text-caption)] text-secondary"
                  >
                    El flujo de trabajo no permite otro estado.
                  </p>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger :class="MENU_ITEM">
                <Icon
                  name="lucide:chevrons-up-down"
                  :class="ICON"
                  aria-hidden="true"
                />
                Cambiar prioridad
                <Icon
                  name="lucide:chevron-right"
                  :class="CHEVRON"
                  aria-hidden="true"
                />
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent
                  :class="[FLOATING_PANEL, 'min-w-44']"
                  :side-offset="4"
                >
                  <DropdownMenuItem
                    v-for="priority in [...session.catalogs.priorities].reverse()"
                    :key="priority.id"
                    :class="MENU_ITEM"
                    :disabled="priority.id === issue.priority.id"
                    @select="apply({ priority_id: priority.id }, 'Prioridad cambiada')"
                  >
                    <Icon
                      :name="priority.id === issue.priority.id ? 'lucide:check' : 'lucide:circle'"
                      :class="ICON"
                      aria-hidden="true"
                    />
                    {{ priority.name }}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger :class="MENU_ITEM">
                <Icon
                  name="lucide:user-round"
                  :class="ICON"
                  aria-hidden="true"
                />
                Asignar a
                <Icon
                  name="lucide:chevron-right"
                  :class="CHEVRON"
                  aria-hidden="true"
                />
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent
                  :class="[FLOATING_PANEL, 'max-h-80 min-w-48 overflow-y-auto']"
                  :side-offset="4"
                >
                  <DropdownMenuItem
                    v-if="issue.assigned_to"
                    :class="MENU_ITEM"
                    @select="apply({ assigned_to_id: null }, 'Asignación cambiada')"
                  >
                    <Icon
                      name="lucide:user-round-x"
                      :class="ICON"
                      aria-hidden="true"
                    />
                    Sin asignar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-for="person in assignees"
                    :key="person.id"
                    :class="MENU_ITEM"
                    :disabled="person.id === issue.assigned_to?.id"
                    @select="apply({ assigned_to_id: person.id }, 'Asignación cambiada')"
                  >
                    <Icon
                      :name="person.id === issue.assigned_to?.id ? 'lucide:check' : 'lucide:circle'"
                      :class="ICON"
                      aria-hidden="true"
                    />
                    {{ person.name }}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger :class="MENU_ITEM">
                <Icon
                  name="lucide:flag"
                  :class="ICON"
                  aria-hidden="true"
                />
                Mover a sprint
                <Icon
                  name="lucide:chevron-right"
                  :class="CHEVRON"
                  aria-hidden="true"
                />
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent
                  :class="[FLOATING_PANEL, 'max-h-80 min-w-48 overflow-y-auto']"
                  :side-offset="4"
                >
                  <DropdownMenuItem
                    v-for="version in openVersions"
                    :key="version.id"
                    :class="MENU_ITEM"
                    :disabled="version.id === issue.fixed_version?.id"
                    @select="apply({ fixed_version_id: version.id }, `Movida a ${version.name}`)"
                  >
                    <Icon
                      :name="version.id === issue.fixed_version?.id ? 'lucide:check' : 'lucide:circle'"
                      :class="ICON"
                      aria-hidden="true"
                    />
                    {{ version.name }}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-if="issue.fixed_version"
                    :class="MENU_ITEM"
                    @select="apply({ fixed_version_id: null }, 'Sacada del sprint')"
                  >
                    <Icon
                      name="lucide:flag-off"
                      :class="ICON"
                      aria-hidden="true"
                    />
                    Sin sprint
                  </DropdownMenuItem>
                  <p
                    v-if="!versions.isLoading.value && openVersions.length === 0"
                    class="px-2 py-2 text-[length:var(--text-caption)] text-secondary"
                  >
                    Este proyecto no tiene sprints abiertos.
                  </p>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuItem
              :class="MENU_ITEM"
              @select="openExternal('/edit')"
            >
              <Icon
                name="lucide:pencil"
                :class="ICON"
                aria-hidden="true"
              />
              Editar en Redmine
            </DropdownMenuItem>
          </Can>

          <DropdownMenuSeparator :class="MENU_SEPARATOR" />
          <DropdownMenuItem
            :class="MENU_ITEM"
            @select="copyLink"
          >
            <Icon
              name="lucide:link"
              :class="ICON"
              aria-hidden="true"
            />
            Copiar enlace
          </DropdownMenuItem>
          <DropdownMenuItem
            :class="MENU_ITEM"
            @select="openExternal()"
          >
            <Icon
              name="lucide:external-link"
              :class="ICON"
              aria-hidden="true"
            />
            Abrir en Redmine
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
