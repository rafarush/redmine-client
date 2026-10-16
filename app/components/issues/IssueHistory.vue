<script setup lang="ts">
import type { Issue, Journal, Paginated } from '../../../shared/redmine/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { explainRejection } from '../../../shared/redmine/issue-actions'
import { buildTimeline } from '../../../shared/redmine/journals'

/**
 * Historial y comentarios de una tarea (F3-T04): línea de tiempo con comentarios y
 * cambios de campo resumidos, y la caja de comentario fija abajo (Ctrl/⌘+Enter
 * publica). El comentario aparece al instante y se reconcilia al volver a leer la
 * tarea. Notas privadas solo con `set_notes_private`.
 */
const props = defineProps<{ issue: Issue }>()

const redmine = useRedmine()
const session = useSessionStore()
const toasts = useToastStore()
const queryClient = useQueryClient()

const projectId = computed(() => props.issue.project.id)
const members = useQuery({
  queryKey: computed(() => ['members', projectId.value]),
  queryFn: () => redmine.listProjectMembers(projectId.value),
  staleTime: 5 * 60_000,
})
const versions = useProjectVersions(projectId)
const detail = useProjectDetail(projectId)

/** Nombre de cada id según el campo; lo que no se conoce queda como número. */
function lookup(field: string, id: string): string | undefined {
  const n = Number(id)
  const c = session.catalogs
  const byId = (list: { id: number, name: string }[] | undefined) => list?.find(x => x.id === n)?.name
  switch (field) {
    case 'status_id': return byId(c.statuses)
    case 'priority_id': return byId(c.priorities)
    case 'tracker_id': return byId(c.trackers)
    case 'project_id': return byId(c.projects)
    case 'assigned_to_id': return byId(members.data.value) ?? (n === session.user?.id ? session.name : undefined)
    case 'fixed_version_id': return byId(versions.data.value)
    case 'category_id': return byId((detail.data.value as { issue_categories?: { id: number, name: string }[] } | undefined)?.issue_categories)
    default: return undefined
  }
}

const customFields = computed(() => new Map((props.issue.custom_fields ?? []).map(f => [f.id, f.name])))
const timeline = computed(() => buildTimeline(props.issue.journals ?? [], lookup, customFields.value))
const commentCount = computed(() => timeline.value.filter(i => i.notes).length)

const dateTimeFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// ------------------------------------------------------------- comentar

const text = ref('')
const isPrivate = ref(false)
const canPrivate = computed(() => session.can('set_notes_private', projectId.value))
const detailKey = computed(() => ['issues', 'detail', props.issue.id])

type Detail = { pages: Paginated<Issue>[] }

const post = useMutation({
  mutationFn: (vars: { notes: string, private: boolean }) =>
    redmine.updateIssue(props.issue.id, { notes: vars.notes, ...(vars.private ? { private_notes: true } : {}) }),
  onMutate: async (vars) => {
    await queryClient.cancelQueries({ queryKey: detailKey.value })
    const before = queryClient.getQueryData<Detail>(detailKey.value)
    const draft: Journal = {
      id: -Date.now(),
      user: { id: session.user?.id ?? 0, name: session.name },
      notes: vars.notes,
      created_on: new Date().toISOString(),
      private_notes: vars.private,
      details: [],
    }
    queryClient.setQueryData<Detail>(detailKey.value, data => data && {
      ...data,
      pages: data.pages.map(page => ({
        ...page,
        items: page.items.map(item => item.id === props.issue.id ? { ...item, journals: [...(item.journals ?? []), draft] } : item),
      })),
    })
    text.value = ''
    return { before, notes: vars.notes }
  },
  onError: (error, _vars, context) => {
    if (context?.before) queryClient.setQueryData(detailKey.value, context.before)
    // Lo escrito no se pierde: vuelve a la caja.
    if (context && !text.value) text.value = context.notes
    toasts.show(`No se pudo publicar el comentario: ${explainRejection(error)}`)
  },
  onSuccess: () => {
    toasts.show('Comentario publicado')
    isPrivate.value = false
  },
  onSettled: () => {
    void queryClient.invalidateQueries({ queryKey: detailKey.value })
  },
})

function submit(): void {
  const notes = text.value.trim()
  if (!notes || post.isPending.value) return
  post.mutate({ notes, private: isPrivate.value && canPrivate.value })
}
</script>

<template>
  <UiPanel label="Historial">
    <template #header>
      <h2 class="panel-label !text-content">
        Historial
      </h2>
      <span class="data ml-auto text-[length:var(--text-caption)] text-secondary">
        {{ commentCount }} comentarios · {{ timeline.length - commentCount }} cambios
      </span>
    </template>

    <ol
      v-if="timeline.length > 0"
      class="flex flex-col"
    >
      <li
        v-for="(item, index) in timeline"
        :key="item.id"
        class="relative flex gap-3 px-4 py-3"
        :class="[index % 2 ? 'bg-fill-alt' : '', item.id < 0 ? 'opacity-70' : '']"
      >
        <span
          class="mt-1 grid size-6 shrink-0 place-items-center rounded-full"
          :class="item.notes ? 'bg-board text-on-board' : 'bg-fill-selected text-secondary'"
          aria-hidden="true"
        >
          <Icon
            :name="item.notes ? 'lucide:message-square' : 'lucide:pencil-line'"
            class="size-3.5"
          />
        </span>
        <div class="min-w-0 flex-1">
          <p class="flex flex-wrap items-baseline gap-x-2 text-[length:var(--text-caption)]">
            <span class="font-semibold text-content">{{ item.author }}</span>
            <span class="data text-secondary">{{ item.id < 0 ? 'publicando…' : dateTimeFormat.format(new Date(item.createdOn)) }}</span>
            <span
              v-if="item.private"
              class="inline-flex items-center gap-1 text-secondary"
            >
              <Icon
                name="lucide:lock"
                class="size-3"
                aria-hidden="true"
              />
              Privado
            </span>
          </p>
          <ul
            v-if="item.changes.length > 0"
            class="mt-1 flex flex-col gap-0.5 text-[length:var(--text-caption)] text-secondary"
          >
            <li
              v-for="(change, i) in item.changes"
              :key="i"
            >
              {{ change.text }}
            </li>
          </ul>
          <TextRichText
            v-if="item.notes"
            :text="item.notes"
            class="mt-1"
          />
        </div>
      </li>
    </ol>
    <p
      v-else
      class="px-4 pb-4 text-secondary"
    >
      Nadie ha comentado ni cambiado nada todavía.
    </p>

    <Can
      permission="add_issue_notes"
      :project="projectId"
    >
      <form
        class="sticky bottom-0 flex flex-col gap-2 border-t border-separator bg-raised px-4 py-3"
        @submit.prevent="submit"
      >
        <label
          for="issue-comment"
          class="sr-only"
        >Comentario</label>
        <textarea
          id="issue-comment"
          v-model="text"
          rows="2"
          placeholder="Escribe un comentario…"
          class="min-h-[var(--control-min)] w-full resize-y rounded-[var(--radius-control)] border border-separator bg-surface px-2.5 py-2"
          @keydown.enter.exact.ctrl.prevent="submit"
          @keydown.enter.exact.meta.prevent="submit"
        />
        <div class="flex flex-wrap items-center gap-3">
          <label
            v-if="canPrivate"
            class="inline-flex items-center gap-2 text-[length:var(--text-caption)] text-secondary"
          >
            <input
              v-model="isPrivate"
              type="checkbox"
            >
            Comentario privado
          </label>
          <span class="ml-auto inline-flex items-center gap-2 text-[length:var(--text-caption)] text-secondary">
            <UiKbd keys="Mod+Enter" />
            <UiButton
              type="submit"
              label="Comentar"
              icon="lucide:send"
              variant="primary"
              :disabled="!text.trim() || post.isPending.value"
            />
          </span>
        </div>
      </form>
    </Can>
  </UiPanel>
</template>
