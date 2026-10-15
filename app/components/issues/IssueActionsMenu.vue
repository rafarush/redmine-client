<script setup lang="ts">
import type { IssueChange } from '../../../shared/redmine/issue-actions'
import type { Issue, Ref } from '../../../shared/redmine/types'
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
import { applyChange, statusOptions } from '../../../shared/redmine/issue-actions'

/**
 * Menú de una tarea (F2-T08): estado, prioridad, asignación, copiar enlace y abrir
 * en Redmine. Se abre desde el botón "…" de la fila o con clic derecho, anclado en
 * `x`/`y`. Cada grupo de cambios va bajo `<Can>`: lo que no se puede hacer no sale.
 */
const props = defineProps<{
  issue: Issue | null
  x: number
  y: number
  open: boolean
}>()
const emit = defineEmits<{ 'update:open': [open: boolean] }>()

const redmine = useRedmine()
const session = useSessionStore()
const toasts = useToastStore()
const { change } = useIssueChange()

const issueId = computed(() => props.issue?.id ?? 0)
const projectId = computed(() => props.issue?.project.id)

/** Estados que el workflow deja a este usuario, cargados al abrir el menú. */
const allowed = useQuery({
  queryKey: computed(() => ['issue-allowed-statuses', issueId.value]),
  queryFn: async () => (await redmine.getIssue(issueId.value, 'allowed_statuses')).allowed_statuses ?? [],
  enabled: computed(() => props.open && issueId.value > 0),
  staleTime: 60_000,
})

/** Personas asignables del proyecto. Se piden solo al abrir el submenú. */
const members = useQuery({
  queryKey: computed(() => ['project-members', projectId.value]),
  queryFn: () => redmine.listProjectMembers(projectId.value!),
  enabled: computed(() => props.open && projectId.value !== undefined),
  staleTime: 5 * 60_000,
})

const statuses = computed(() => statusOptions(props.issue ?? { status: { id: 0 } } as Issue, allowed.data.value))
const priorities = computed(() => session.catalogs.priorities.filter(p => p.id !== props.issue?.priority.id))
const assignees = computed<Ref[]>(() => (members.data.value ?? []).filter(m => m.id !== props.issue?.assigned_to?.id))

function apply(next: IssueChange, label: string): void {
  if (!props.issue) return
  const optimistic = applyChange(props.issue, next, {
    statuses: allowed.data.value ?? [],
    priorities: session.catalogs.priorities,
    members: members.data.value ?? [],
  })
  change(props.issue, next, optimistic, label)
}

async function copyLink(): Promise<void> {
  if (!props.issue) return
  const url = `${session.url.replace(/\/$/, '')}/issues/${props.issue.id}`
  try {
    await navigator.clipboard.writeText(url)
    toasts.show('Enlace copiado')
  }
  catch {
    toasts.show('No se pudo copiar el enlace')
  }
}

function openInRedmine(): void {
  if (!props.issue) return
  window.open(`${session.url.replace(/\/$/, '')}/issues/${props.issue.id}`, '_blank', 'noopener')
}

const itemClass = 'flex min-h-[var(--control-min)] cursor-default items-center gap-2 rounded-[var(--radius-control)] px-2 text-[length:var(--text-body)] text-content outline-none data-[highlighted]:bg-surface data-[disabled]:opacity-50'
const contentClass = 'z-50 min-w-48 rounded-[var(--radius-surface)] border border-separator bg-raised p-1 shadow-lg'
</script>

<template>
  <DropdownMenuRoot
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <!-- Ancla invisible en el punto donde se pulsó, para el clic derecho. -->
    <DropdownMenuTrigger as-child>
      <span
        class="pointer-events-none fixed size-0"
        :style="{ left: `${x}px`, top: `${y}px` }"
        aria-hidden="true"
      />
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent
        :class="contentClass"
        align="start"
        :side-offset="4"
        @close-auto-focus.prevent
      >
        <template v-if="issue">
          <Can
            permission="edit_issues"
            :project="issue.project.id"
          >
            <DropdownMenuSub>
              <DropdownMenuSubTrigger :class="itemClass">
                <Icon
                  name="lucide:circle-dot"
                  class="size-4 text-secondary"
                  aria-hidden="true"
                />
                Cambiar estado
                <Icon
                  name="lucide:chevron-right"
                  class="ml-auto size-4 text-secondary"
                  aria-hidden="true"
                />
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent
                  :class="contentClass"
                  :side-offset="4"
                >
                  <DropdownMenuItem
                    v-for="status in statuses"
                    :key="status.id"
                    :class="itemClass"
                    @select="apply({ status_id: status.id }, 'Estado cambiado')"
                  >
                    {{ status.name }}
                  </DropdownMenuItem>
                  <p
                    v-if="!allowed.isLoading.value && statuses.length === 0"
                    class="px-2 py-2 text-[length:var(--text-caption)] text-secondary"
                  >
                    Ningún estado disponible desde aquí.
                  </p>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger :class="itemClass">
                <Icon
                  name="lucide:flag"
                  class="size-4 text-secondary"
                  aria-hidden="true"
                />
                Cambiar prioridad
                <Icon
                  name="lucide:chevron-right"
                  class="ml-auto size-4 text-secondary"
                  aria-hidden="true"
                />
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent
                  :class="contentClass"
                  :side-offset="4"
                >
                  <DropdownMenuItem
                    v-for="priority in priorities"
                    :key="priority.id"
                    :class="itemClass"
                    @select="apply({ priority_id: priority.id }, 'Prioridad cambiada')"
                  >
                    {{ priority.name }}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger :class="itemClass">
                <Icon
                  name="lucide:user-round"
                  class="size-4 text-secondary"
                  aria-hidden="true"
                />
                Asignar a
                <Icon
                  name="lucide:chevron-right"
                  class="ml-auto size-4 text-secondary"
                  aria-hidden="true"
                />
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent
                  :class="contentClass"
                  :side-offset="4"
                >
                  <DropdownMenuItem
                    v-if="issue.assigned_to"
                    :class="itemClass"
                    @select="apply({ assigned_to_id: null }, 'Asignación cambiada')"
                  >
                    Sin asignar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-for="person in assignees"
                    :key="person.id"
                    :class="itemClass"
                    @select="apply({ assigned_to_id: person.id }, 'Asignación cambiada')"
                  >
                    {{ person.name }}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSeparator class="my-1 h-px bg-separator" />
          </Can>

          <DropdownMenuItem
            :class="itemClass"
            @select="copyLink"
          >
            <Icon
              name="lucide:link"
              class="size-4 text-secondary"
              aria-hidden="true"
            />
            Copiar enlace
          </DropdownMenuItem>
          <DropdownMenuItem
            :class="itemClass"
            @select="openInRedmine"
          >
            <Icon
              name="lucide:external-link"
              class="size-4 text-secondary"
              aria-hidden="true"
            />
            Abrir en Redmine
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
