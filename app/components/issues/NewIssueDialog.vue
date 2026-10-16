<script setup lang="ts">
import type { IssueDraft } from '../../../shared/redmine/new-issue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { explainRejection } from '../../../shared/redmine/issue-actions'
import { emptyDraft, isDraftDirty, nextDraft, sanitizeDraft, toCreatePayload, validateDraft } from '../../../shared/redmine/new-issue'
import { RedmineError } from '../../../shared/redmine/transport'

/**
 * "Nueva tarea" (F3-T07). Una sola instancia en el layout; la abren el botón de la
 * toolbar y el atajo (`useNewIssue`). Campos visibles: proyecto, tipo, asunto,
 * descripción, asignada y prioridad; "Más campos" despliega el resto. Ctrl/⌘+Enter
 * crea. El borrador se guarda solo y cerrar con algo escrito pregunta.
 */
const DRAFT_KEY = 'redmine-client:new-issue-draft'
const PROJECT_KEY = 'redmine-client:new-issue-project'

const { isOpen, prefill } = useNewIssue()
const redmine = useRedmine()
const session = useSessionStore()
const toasts = useToastStore()
const queryClient = useQueryClient()

/** Solo proyectos activos donde se puede crear. */
const projects = computed(() => session.catalogs.projects
  .filter(p => p.status === 1 && session.can('add_issues', p.id))
  .sort((a, b) => a.name.localeCompare(b.name, 'es')))

const draft = ref<IssueDraft>(emptyDraft())
const errors = ref<Record<string, string>>({})
const more = ref(false)
const confirming = ref(false)
const saving = ref(false)

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  }
  catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  }
  catch {
    // Sin almacenamiento se pierde el borrador al recargar; no es un error.
  }
}

function defaultPriority(): string {
  const priorities = session.catalogs.priorities
  return String((priorities.find(p => p.is_default) ?? priorities[0])?.id ?? '')
}

/** Al abrir: el borrador guardado, o uno nuevo en el último proyecto usado. */
function prepare(): void {
  const saved = sanitizeDraft(JSON.parse(read(DRAFT_KEY) ?? 'null'))
  if (prefill.value) {
    // "Duplicar" (F3-T08): manda sobre el borrador guardado.
    draft.value = prefill.value
    prefill.value = null
    // Sin `add_issues` en el proyecto de origen, la copia va al primero donde sí se puede.
    if (!projects.value.some(p => String(p.id) === draft.value.project_id)) {
      draft.value.project_id = projects.value[0] ? String(projects.value[0].id) : ''
    }
  }
  else if (saved && isDraftDirty(saved) && projects.value.some(p => String(p.id) === saved.project_id)) {
    draft.value = saved
  }
  else {
    const last = read(PROJECT_KEY)
    const project = projects.value.find(p => String(p.id) === last) ?? projects.value[0]
    draft.value = emptyDraft({ project_id: project ? String(project.id) : '', priority_id: defaultPriority() })
  }
  errors.value = {}
  confirming.value = false
  more.value = Object.keys(draft.value.custom).length > 0 || !!(draft.value.due_date || draft.value.start_date || draft.value.estimated_hours)
  void nextTick(() => document.querySelector<HTMLInputElement>('#new-issue-subject')?.focus())
}

watch(isOpen, (open) => {
  if (open) prepare()
})

watch(draft, (value) => {
  if (isOpen.value) write(DRAFT_KEY, isDraftDirty(value) ? JSON.stringify(value) : null)
}, { deep: true })

const project = computed(() => projects.value.find(p => String(p.id) === draft.value.project_id))
const trackers = computed(() => project.value?.trackers ?? session.catalogs.trackers)

// El tipo tiene que existir en el proyecto: si no, el primero que tenga.
watch([trackers, () => draft.value.tracker_id], () => {
  if (!trackers.value.some(t => String(t.id) === draft.value.tracker_id)) {
    draft.value.tracker_id = trackers.value[0] ? String(trackers.value[0].id) : ''
  }
}, { immediate: true })

const projectId = computed(() => project.value?.id)
const members = useQuery({
  queryKey: computed(() => ['members', projectId.value]),
  queryFn: () => redmine.listProjectMembers(projectId.value!),
  enabled: computed(() => isOpen.value && projectId.value !== undefined),
  staleTime: 10 * 60_000,
})
const versions = useProjectVersions(() => isOpen.value && more.value ? projectId.value : undefined)
const detail = useProjectDetail(() => isOpen.value ? projectId.value : undefined)
const openVersions = computed(() => (versions.data.value ?? []).filter(v => v.status === 'open'))
const categories = computed(() => detail.data.value?.issue_categories ?? [])
const customFields = computed(() => detail.data.value?.issue_custom_fields ?? [])

/** Asunto de la tarea padre elegida; si viene de un borrador solo se conoce el número. */
const parentSubject = ref('')
function pickParent(issue: { id: number, subject: string }): void {
  draft.value.parent_issue_id = String(issue.id)
  parentSubject.value = issue.subject
}
watch(() => draft.value.parent_issue_id, (id) => {
  if (!id.trim()) parentSubject.value = ''
})

const title = computed(() => project.value ? `Nueva tarea en ${project.value.name}` : 'Nueva tarea')

// ---------------------------------------------------------------- cerrar

/** Cerrar con algo escrito no lo pierde en silencio: pregunta (`modality.md`). */
const dialogOpen = computed({
  get: () => isOpen.value,
  set: (value: boolean) => {
    if (value) {
      isOpen.value = true
      return
    }
    if (isDraftDirty(draft.value) && !confirming.value) {
      confirming.value = true
      return
    }
    isOpen.value = false
  },
})

function discard(): void {
  write(DRAFT_KEY, null)
  confirming.value = false
  isOpen.value = false
}

// ---------------------------------------------------------------- crear

async function create(another = false): Promise<void> {
  if (saving.value) return
  errors.value = validateDraft(draft.value)
  if (Object.keys(errors.value).length > 0) {
    const first = Object.keys(errors.value)[0]!
    if (first.startsWith('custom.') || ['start_date', 'due_date', 'estimated_hours', 'parent_issue_id'].includes(first)) more.value = true
    return
  }
  saving.value = true
  try {
    const issue = await redmine.createIssue(toCreatePayload(draft.value))
    write(PROJECT_KEY, draft.value.project_id)
    toasts.show(`Tarea #${issue.id} creada`, { label: 'Abrir', run: () => {
      void navigateTo(`/issues/${issue.id}`)
    } })
    void queryClient.invalidateQueries({ queryKey: ['issues'] })
    if (another) {
      draft.value = nextDraft(draft.value)
      write(DRAFT_KEY, null)
      void nextTick(() => document.querySelector<HTMLInputElement>('#new-issue-subject')?.focus())
    }
    else {
      write(DRAFT_KEY, null)
      draft.value = emptyDraft()
      isOpen.value = false
    }
  }
  catch (error) {
    // Un 422 trae los motivos de Redmine (p. ej. un campo obligatorio del tipo).
    const message = explainRejection(error)
    if (error instanceof RedmineError && error.status === 422) errors.value = { form: message }
    else toasts.show(`No se pudo crear la tarea: ${message}`)
  }
  finally {
    saving.value = false
  }
}

function onKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    void create(event.shiftKey)
  }
}

const FIELD = 'min-h-[var(--control-min)] w-full rounded-[var(--radius-control)] border border-separator bg-surface px-2.5 aria-[invalid=true]:border-warning'
const LABEL = 'flex flex-col gap-1'
</script>

<template>
  <UiDialog
    v-model:open="dialogOpen"
    :title="confirming ? '¿Descartar la tarea?' : title"
    :description="confirming ? 'Lo que has escrito se perderá.' : undefined"
    :width="confirming ? 24 : 40"
  >
    <div
      v-if="confirming"
      class="flex justify-end gap-2 pt-2"
    >
      <UiButton
        label="Seguir editando"
        variant="primary"
        @click="confirming = false"
      />
      <UiButton
        label="Descartar"
        @click="discard"
      />
    </div>

    <form
      v-else
      class="flex flex-col gap-4"
      novalidate
      @submit.prevent="create(false)"
      @keydown="onKeydown"
    >
      <p
        v-if="projects.length === 0"
        class="text-secondary"
      >
        No puedes crear tareas en ningún proyecto.
      </p>

      <p
        v-if="errors.form"
        role="alert"
        class="rounded-[var(--radius-control)] border border-warning px-3 py-2 text-warning"
      >
        {{ errors.form }}
      </p>

      <div class="grid gap-3 wide:grid-cols-2">
        <label :class="LABEL">
          <span class="panel-label">Proyecto</span>
          <UiSelect
            v-model="draft.project_id"
            :options="projects.map(p => ({ value: String(p.id), label: p.name }))"
            :invalid="!!errors.project_id"
          />
        </label>
        <label :class="LABEL">
          <span class="panel-label">Tipo</span>
          <UiSelect
            v-model="draft.tracker_id"
            :options="trackers.map(t => ({ value: String(t.id), label: t.name }))"
            :invalid="!!errors.tracker_id"
          />
        </label>
      </div>

      <label :class="LABEL">
        <span class="panel-label">Asunto</span>
        <input
          id="new-issue-subject"
          v-model="draft.subject"
          type="text"
          maxlength="255"
          :aria-invalid="!!errors.subject"
          aria-describedby="new-issue-subject-error"
          :class="FIELD"
        >
        <span
          v-if="errors.subject"
          id="new-issue-subject-error"
          class="text-[length:var(--text-caption)] text-warning"
        >{{ errors.subject }}</span>
      </label>

      <label :class="LABEL">
        <span class="panel-label">Descripción</span>
        <textarea
          v-model="draft.description"
          rows="4"
          :class="[FIELD, 'py-2']"
        />
      </label>

      <label
        v-if="categories.length > 0"
        :class="LABEL"
      >
        <span class="panel-label">Categoría</span>
        <UiSelect
          v-model="draft.category_id"
          :options="[{ value: '', label: 'Sin categoría' }, ...categories.map(c => ({ value: String(c.id), label: c.name }))]"
        />
      </label>

      <div class="grid gap-3 wide:grid-cols-2">
        <label :class="LABEL">
          <span class="panel-label">Asignada a</span>
          <UiSelect
            v-model="draft.assigned_to_id"
            :options="[{ value: '', label: 'Sin asignar' }, ...(members.data.value ?? []).map(m => ({ value: String(m.id), label: m.id === session.user?.id ? `${m.name} (yo)` : m.name }))]"
          />
        </label>
        <label :class="LABEL">
          <span class="panel-label">Prioridad</span>
          <UiSelect
            v-model="draft.priority_id"
            :options="session.catalogs.priorities.map(p => ({ value: String(p.id), label: p.name }))"
          />
        </label>
      </div>

      <button
        type="button"
        class="inline-flex items-center gap-1 self-start text-secondary hover:text-content"
        :aria-expanded="more"
        aria-controls="new-issue-more"
        @click="more = !more"
      >
        <Icon
          :name="more ? 'lucide:chevron-down' : 'lucide:chevron-right'"
          class="size-4"
          aria-hidden="true"
        />
        Más campos
      </button>

      <div
        v-show="more"
        id="new-issue-more"
        class="grid gap-3 wide:grid-cols-2"
      >
        <label :class="LABEL">
          <span class="panel-label">Sprint</span>
          <UiSelect
            v-model="draft.fixed_version_id"
            :options="[{ value: '', label: 'Sin sprint' }, ...openVersions.map(v => ({ value: String(v.id), label: v.name }))]"
          />
        </label>
        <label :class="LABEL">
          <span class="panel-label">Empieza</span>
          <input
            v-model="draft.start_date"
            type="date"
            :aria-invalid="!!errors.start_date"
            :class="[FIELD, 'data']"
          >
        </label>
        <label :class="LABEL">
          <span class="panel-label">Vence</span>
          <input
            v-model="draft.due_date"
            type="date"
            :aria-invalid="!!errors.due_date"
            :class="[FIELD, 'data']"
          >
          <span
            v-if="errors.due_date"
            class="text-[length:var(--text-caption)] text-warning"
          >{{ errors.due_date }}</span>
        </label>
        <label :class="LABEL">
          <span class="panel-label">Estimado</span>
          <input
            v-model="draft.estimated_hours"
            type="text"
            inputmode="decimal"
            placeholder="4 o 1h30"
            :aria-invalid="!!errors.estimated_hours"
            :class="[FIELD, 'data']"
          >
          <span
            v-if="errors.estimated_hours"
            class="text-[length:var(--text-caption)] text-warning"
          >{{ errors.estimated_hours }}</span>
        </label>
        <div :class="LABEL">
          <span class="panel-label">Tarea padre</span>
          <div
            v-if="draft.parent_issue_id.trim()"
            :class="[FIELD, 'flex items-center gap-2 py-1']"
          >
            <span class="data shrink-0 text-secondary">#{{ draft.parent_issue_id.replace('#', '').trim() }}</span>
            <span class="min-w-0 flex-1 truncate">{{ parentSubject }}</span>
            <UiButton
              label="Quitar la tarea padre"
              icon="lucide:x"
              icon-only
              variant="ghost"
              @click="draft.parent_issue_id = ''"
            />
          </div>
          <IssuesIssuePicker
            v-else
            label="Tarea padre"
            @pick="pickParent"
          />
          <span
            v-if="errors.parent_issue_id"
            class="text-[length:var(--text-caption)] text-warning"
          >{{ errors.parent_issue_id }}</span>
        </div>
        <label
          v-for="field in customFields"
          :key="field.id"
          :class="LABEL"
        >
          <span class="panel-label">{{ field.name }}</span>
          <input
            v-model="draft.custom[String(field.id)]"
            type="text"
            :aria-invalid="!!errors[`custom.${field.id}`]"
            :class="FIELD"
          >
        </label>
      </div>

      <button
        type="submit"
        class="sr-only"
      >
        Crear tarea
      </button>
    </form>

    <template
      v-if="!confirming"
      #footer
    >
      <span class="mr-auto hidden items-center gap-1 text-[length:var(--text-caption)] text-secondary wide:inline-flex">
        <UiKbd keys="Mod+Enter" /> crea · <UiKbd keys="Mod+Shift+Enter" /> crea y otra
      </span>
      <UiButton
        label="Crear y otra"
        :disabled="saving || projects.length === 0"
        @click="create(true)"
      />
      <UiButton
        :label="saving ? 'Creando…' : 'Crear tarea'"
        variant="primary"
        :disabled="saving || projects.length === 0"
        @click="create(false)"
      />
    </template>
  </UiDialog>
</template>
