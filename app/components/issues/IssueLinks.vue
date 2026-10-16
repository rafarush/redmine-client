<script setup lang="ts">
import type { Issue } from '../../../shared/redmine/types'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { explainRejection } from '../../../shared/redmine/issue-actions'
import { CREATABLE_RELATIONS, describeRelation, issueExtras } from '../../../shared/redmine/relations'

/**
 * Relaciones, subtareas y observadores (F3-T05), en listas compactas con añadir y
 * quitar según permisos: `manage_issue_relations`, `manage_subtasks`,
 * `add_issue_watchers` / `delete_issue_watchers`. Al crear "bloquea a #N", Redmine
 * pone el inverso en #N, así que se ve en las dos tareas.
 */
const props = defineProps<{ issue: Issue }>()

const redmine = useRedmine()
const session = useSessionStore()
const toasts = useToastStore()
const queryClient = useQueryClient()

const projectId = computed(() => props.issue.project.id)
const extras = computed(() => issueExtras(props.issue))
const relations = computed(() => extras.value.relations.map(r => ({ ...r, ...describeRelation(r, props.issue.id) })))

/** Hijas en plano con su nivel, para pintarlas como árbol sangrado. */
const children = computed(() => {
  const flat: { id: number, subject: string, depth: number }[] = []
  const walk = (list: typeof extras.value.children, depth: number) => {
    for (const child of list) {
      flat.push({ id: child.id, subject: child.subject, depth })
      walk(child.children ?? [], depth + 1)
    }
  }
  walk(extras.value.children, 0)
  return flat
})

/** Asunto de las tareas relacionadas: una consulta para todas. */
const relatedIds = computed(() => [...new Set(relations.value.map(r => r.otherId))].sort((a, b) => a - b))
const related = useQuery({
  queryKey: computed(() => ['issues', 'subjects', relatedIds.value.join(',')]),
  queryFn: async () => ({ pages: [await redmine.listIssues({ issue_id: relatedIds.value.join(','), status_id: '*', limit: 100 })] }),
  enabled: computed(() => relatedIds.value.length > 0),
})
const subjectOf = computed(() => new Map((related.data.value?.pages[0]?.items ?? []).map(i => [i.id, i])))
const closedIds = computed(() => new Set(session.catalogs.statuses.filter(s => s.is_closed).map(s => s.id)))

const canRelate = computed(() => session.can('manage_issue_relations', projectId.value))
const canSubtask = computed(() => session.can('manage_subtasks', projectId.value))
const canAddWatcher = computed(() => session.can('add_issue_watchers', projectId.value))
const canRemoveWatcher = computed(() => session.can('delete_issue_watchers', projectId.value))

const members = useQuery({
  queryKey: computed(() => ['members', projectId.value]),
  queryFn: () => redmine.listProjectMembers(projectId.value),
  enabled: canAddWatcher,
  staleTime: 10 * 60_000,
})
const watcherCandidates = computed(() => (members.data.value ?? []).filter(m => !extras.value.watchers.some(w => w.id === m.id)))

/** Ejecuta un cambio, avisa y vuelve a leer esta tarea (y la otra, que también cambia). */
async function run(action: () => Promise<void>, done: string, otherId?: number): Promise<void> {
  try {
    await action()
    toasts.show(done)
  }
  catch (error) {
    toasts.show(explainRejection(error))
  }
  finally {
    void queryClient.invalidateQueries({ queryKey: ['issues', 'detail', props.issue.id] })
    if (otherId) void queryClient.invalidateQueries({ queryKey: ['issues', 'detail', otherId] })
  }
}

const relationType = ref('relates')
function addRelation(other: Issue): void {
  const label = CREATABLE_RELATIONS.find(r => r.type === relationType.value)?.label ?? ''
  void run(() => redmine.createRelation(props.issue.id, { issue_to_id: other.id, relation_type: relationType.value }), `Relación creada: ${label.toLowerCase()} #${other.id}`, other.id)
}
function removeRelation(id: number, otherId: number): void {
  void run(() => redmine.deleteRelation(id), 'Relación quitada', otherId)
}

function addChild(child: Issue): void {
  void run(() => redmine.updateIssue(child.id, { parent_issue_id: props.issue.id }), `#${child.id} es ahora subtarea`, child.id)
}
function removeChild(id: number): void {
  void run(() => redmine.updateIssue(id, { parent_issue_id: '' }), `#${id} ya no es subtarea`, id)
}

const watcherToAdd = ref<number | ''>('')
function addWatcher(): void {
  const id = watcherToAdd.value
  if (id === '') return
  watcherToAdd.value = ''
  void run(() => redmine.addWatcher(props.issue.id, id), 'Observador añadido')
}
function removeWatcher(id: number, name: string): void {
  void run(() => redmine.removeWatcher(props.issue.id, id), `${name} ya no observa la tarea`)
}

const exclude = computed(() => [props.issue.id, ...relatedIds.value, ...children.value.map(c => c.id)])
const ROW = 'flex min-h-9 items-center gap-2 px-4'
const FIELD = 'min-h-[var(--control-min)] rounded-[var(--radius-control)] border border-separator bg-surface px-2'
</script>

<template>
  <UiPanel label="Vínculos">
    <template #header>
      <h2 class="panel-label !text-content">
        Vínculos
      </h2>
    </template>

    <section
      aria-labelledby="links-relations"
      class="flex flex-col gap-1 pb-3"
    >
      <h3
        id="links-relations"
        class="px-4 text-[length:var(--text-caption)] font-medium text-secondary"
      >
        Relaciones
      </h3>
      <ul v-if="relations.length > 0">
        <li
          v-for="relation in relations"
          :key="relation.id"
          :class="ROW"
        >
          <span class="shrink-0 text-secondary">{{ relation.label }}</span>
          <NuxtLink
            :to="`/issues/${relation.otherId}`"
            class="flex min-w-0 flex-1 items-baseline gap-2 hover:underline"
            :class="subjectOf.get(relation.otherId) && closedIds.has(subjectOf.get(relation.otherId)!.status.id) ? 'text-secondary line-through' : ''"
          >
            <span class="data shrink-0">#{{ relation.otherId }}</span>
            <span class="truncate">{{ subjectOf.get(relation.otherId)?.subject ?? '' }}</span>
          </NuxtLink>
          <UiButton
            v-if="canRelate"
            :label="`Quitar la relación con #${relation.otherId}`"
            icon="lucide:x"
            icon-only
            variant="ghost"
            @click="removeRelation(relation.id, relation.otherId)"
          />
        </li>
      </ul>
      <p
        v-else
        class="px-4 text-secondary"
      >
        Sin relaciones.
      </p>
      <div
        v-if="canRelate"
        class="flex flex-wrap gap-2 px-4 pt-1"
      >
        <select
          v-model="relationType"
          aria-label="Tipo de relación"
          :class="FIELD"
        >
          <option
            v-for="option in CREATABLE_RELATIONS"
            :key="option.type"
            :value="option.type"
          >
            {{ option.label }}
          </option>
        </select>
        <IssuesIssuePicker
          label="Tarea con la que relacionar"
          :exclude="exclude"
          @pick="addRelation"
        />
      </div>
    </section>

    <section
      aria-labelledby="links-children"
      class="flex flex-col gap-1 border-t border-separator py-3"
    >
      <h3
        id="links-children"
        class="px-4 text-[length:var(--text-caption)] font-medium text-secondary"
      >
        Subtareas
      </h3>
      <ul v-if="children.length > 0">
        <li
          v-for="child in children"
          :key="child.id"
          :class="ROW"
          :style="{ paddingLeft: `${1 + child.depth * 1.25}rem` }"
        >
          <NuxtLink
            :to="`/issues/${child.id}`"
            class="flex min-w-0 flex-1 items-baseline gap-2 hover:underline"
          >
            <span class="data shrink-0 text-secondary">#{{ child.id }}</span>
            <span class="truncate">{{ child.subject }}</span>
          </NuxtLink>
          <UiButton
            v-if="canSubtask && child.depth === 0"
            :label="`Quitar #${child.id} de las subtareas`"
            icon="lucide:x"
            icon-only
            variant="ghost"
            @click="removeChild(child.id)"
          />
        </li>
      </ul>
      <p
        v-else
        class="px-4 text-secondary"
      >
        Sin subtareas.
      </p>
      <div
        v-if="canSubtask"
        class="flex px-4 pt-1"
      >
        <IssuesIssuePicker
          label="Tarea existente que hacer subtarea"
          :exclude="exclude"
          @pick="addChild"
        />
      </div>
    </section>

    <section
      aria-labelledby="links-watchers"
      class="flex flex-col gap-1 border-t border-separator py-3"
    >
      <h3
        id="links-watchers"
        class="px-4 text-[length:var(--text-caption)] font-medium text-secondary"
      >
        Observadores
      </h3>
      <ul v-if="extras.watchers.length > 0">
        <li
          v-for="watcher in extras.watchers"
          :key="watcher.id"
          :class="ROW"
        >
          <Icon
            name="lucide:eye"
            class="size-4 shrink-0 text-secondary"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1 truncate">{{ watcher.name }}</span>
          <UiButton
            v-if="canRemoveWatcher"
            :label="`Quitar a ${watcher.name} de observadores`"
            icon="lucide:x"
            icon-only
            variant="ghost"
            @click="removeWatcher(watcher.id, watcher.name)"
          />
        </li>
      </ul>
      <p
        v-else
        class="px-4 text-secondary"
      >
        Nadie observa esta tarea.
      </p>
      <form
        v-if="canAddWatcher && watcherCandidates.length > 0"
        class="flex gap-2 px-4 pt-1"
        @submit.prevent="addWatcher"
      >
        <select
          v-model="watcherToAdd"
          aria-label="Persona que añadir como observador"
          :class="[FIELD, 'min-w-0 flex-1']"
        >
          <option value="">
            Elegir persona…
          </option>
          <option
            v-for="person in watcherCandidates"
            :key="person.id"
            :value="person.id"
          >
            {{ person.name }}
          </option>
        </select>
        <UiButton
          type="submit"
          label="Añadir"
          icon="lucide:plus"
          :disabled="watcherToAdd === ''"
        />
      </form>
    </section>
  </UiPanel>
</template>
