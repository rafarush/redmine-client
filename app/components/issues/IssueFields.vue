<script setup lang="ts">
import type { EditableField } from '../../../shared/redmine/issue-fields'
import type { Issue } from '../../../shared/redmine/types'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { explainRejection } from '../../../shared/redmine/issue-actions'
import { canEditIssue, currentFieldValue, DONE_RATIOS, FIELD_LABELS, toFieldPayload } from '../../../shared/redmine/issue-fields'
import { RedmineError } from '../../../shared/redmine/transport'
import { formatDuration } from '../../../shared/time/duration'
import { describeDue } from '../../../shared/workspace/due'

/**
 * Datos de la tarea con edición en línea (F3-T02). Cada campo se guarda solo al
 * elegir o al pulsar Enter, muestra "Guardado" y deja "Deshacer" en el aviso; un
 * 422 de Redmine sale junto al campo. Sin permiso (`edit_issues`, o
 * `edit_own_issues` si es tuya) todo se muestra como texto.
 */
const props = defineProps<{ issue: Issue }>()

const redmine = useRedmine()
const session = useSessionStore()
const toasts = useToastStore()
const queryClient = useQueryClient()

const projectId = computed(() => props.issue.project.id)
const canEdit = computed(() => canEditIssue(props.issue, session.user?.id, (p, id) => session.can(p, id)))

const members = useQuery({
  queryKey: computed(() => ['members', projectId.value]),
  queryFn: () => redmine.listProjectMembers(projectId.value),
  enabled: canEdit,
  staleTime: 10 * 60_000,
})
const versions = useProjectVersions(() => canEdit.value ? projectId.value : undefined)
const project = useProjectDetail(() => canEdit.value ? projectId.value : undefined)

type Option = { value: string, label: string }
const toOptions = (list: { id: number, name: string }[] = []): Option[] => list.map(x => ({ value: String(x.id), label: x.name }))

/** Opciones de cada lista; el valor actual siempre está, aunque ya no se ofrezca. */
function optionsFor(field: EditableField): Option[] | undefined {
  const i = props.issue
  const withCurrent = (list: Option[], current?: { id: number, name: string }) =>
    current && !list.some(o => o.value === String(current.id)) ? [{ value: String(current.id), label: current.name }, ...list] : list
  switch (field) {
    case 'status_id': return withCurrent(toOptions(i.allowed_statuses ?? []), i.status)
    case 'priority_id': return toOptions(session.catalogs.priorities)
    case 'assigned_to_id': return [{ value: '', label: 'Sin asignar' }, ...withCurrent(toOptions(members.data.value), i.assigned_to)]
    case 'fixed_version_id': return [{ value: '', label: 'Sin sprint' }, ...withCurrent(toOptions((versions.data.value ?? []).filter(v => v.status === 'open')), i.fixed_version)]
    case 'category_id': return [{ value: '', label: 'Sin categoría' }, ...withCurrent(toOptions(project.data.value?.issue_categories), i.category)]
    case 'done_ratio': return DONE_RATIOS.map(n => ({ value: String(n), label: `${n} %` }))
    default: return undefined
  }
}

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })
const formatDate = (iso?: string | null) => iso ? dateFormat.format(new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)) : '—'
const hours = (value?: number | null) => value ? formatDuration(value) : '—'

interface Row {
  key: string
  label: string
  value: string
  field?: EditableField
  input?: 'select' | 'date' | 'text'
  data?: boolean
  warn?: boolean
}

const rows = computed<Row[]>(() => {
  const i = props.issue
  const due = describeDue(i.due_date, today())
  const custom: Row[] = (i.custom_fields ?? []).map(f => ({
    key: `cf_${f.id}`,
    label: f.name,
    value: (Array.isArray(f.value) ? f.value.join(', ') : f.value) || '—',
    // Sin la definición del campo (solo admin) no se sabe su tipo: se editan como texto los de un valor.
    field: f.multiple ? undefined : `cf_${f.id}` as EditableField,
    input: 'text' as const,
  }))
  return [
    { key: 'status_id', label: FIELD_LABELS.status_id, value: i.status.name, field: 'status_id', input: 'select' },
    { key: 'assigned_to_id', label: FIELD_LABELS.assigned_to_id, value: i.assigned_to?.name ?? 'Sin asignar', field: 'assigned_to_id', input: 'select' },
    { key: 'priority_id', label: FIELD_LABELS.priority_id, value: i.priority.name, field: 'priority_id', input: 'select' },
    { key: 'fixed_version_id', label: FIELD_LABELS.fixed_version_id, value: i.fixed_version?.name ?? 'Sin sprint', field: 'fixed_version_id', input: 'select' },
    { key: 'category_id', label: FIELD_LABELS.category_id, value: i.category?.name ?? '—', field: 'category_id', input: 'select' },
    { key: 'start_date', label: FIELD_LABELS.start_date, value: formatDate(i.start_date), field: 'start_date', input: 'date', data: true },
    { key: 'due_date', label: FIELD_LABELS.due_date, value: i.due_date ? `${formatDate(i.due_date)} · ${due.label}` : '—', field: 'due_date', input: 'date', data: true, warn: due.tone === 'overdue' },
    { key: 'estimated_hours', label: FIELD_LABELS.estimated_hours, value: hours(i.estimated_hours), field: 'estimated_hours', input: 'text', data: true },
    { key: 'spent', label: 'Dedicado', value: hours(i.spent_hours), data: true },
    { key: 'done_ratio', label: FIELD_LABELS.done_ratio, value: `${i.done_ratio} %`, field: 'done_ratio', input: 'select', data: true },
    ...custom,
    { key: 'author', label: 'Autor', value: i.author.name },
    { key: 'created', label: 'Creada', value: formatDate(i.created_on), data: true },
    { key: 'updated', label: 'Actualizada', value: formatDate(i.updated_on), data: true },
  ]
})

// ------------------------------------------------------------------ edición

const editing = ref<EditableField | null>(null)
const draft = ref('')
const errors = ref<Partial<Record<string, string>>>({})
const saved = ref<string | null>(null)
let savedTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(savedTimer))

async function startEditing(field: EditableField): Promise<void> {
  editing.value = field
  draft.value = currentFieldValue(field, props.issue)
  errors.value = { ...errors.value, [field]: undefined }
  await nextTick()
  document.querySelector<HTMLElement>(`[data-field-editor="${field}"]`)?.focus()
}

function cancel(): void {
  const field = editing.value
  editing.value = null
  if (field) void nextTick(() => document.querySelector<HTMLElement>(`[data-field-button="${field}"]`)?.focus())
}

const detailKey = computed(() => ['issues', 'detail', props.issue.id])

async function put(field: EditableField, raw: string): Promise<boolean> {
  const result = toFieldPayload(field, raw, props.issue)
  if (!result.ok) {
    errors.value = { ...errors.value, [field]: result.error }
    return false
  }
  try {
    await redmine.updateIssue(props.issue.id, result.payload)
    errors.value = { ...errors.value, [field]: undefined }
    return true
  }
  catch (error) {
    // Un 422 es de este campo: se dice junto a él. Lo demás va al aviso.
    if (error instanceof RedmineError && error.status === 422) errors.value = { ...errors.value, [field]: explainRejection(error) }
    else toasts.show(`No se pudo guardar: ${explainRejection(error)}`)
    return false
  }
  finally {
    void queryClient.invalidateQueries({ queryKey: detailKey.value })
    void queryClient.invalidateQueries({ queryKey: ['issues'], predicate: q => q.queryKey[1] !== 'detail' })
  }
}

async function commit(): Promise<void> {
  const field = editing.value
  if (!field) return
  const before = currentFieldValue(field, props.issue)
  const value = draft.value
  if (value.trim() === before) {
    cancel()
    return
  }
  editing.value = null
  const ok = await put(field, value)
  if (!ok) {
    editing.value = field
    draft.value = value
    return
  }
  saved.value = field
  clearTimeout(savedTimer)
  savedTimer = setTimeout(() => {
    saved.value = null
  }, 2000)
  const label = rows.value.find(r => r.key === field)?.label ?? 'Campo'
  toasts.show(`${label} guardado`, { label: 'Deshacer', run: () => void put(field, before) })
}

const FIELD = 'min-h-8 w-full rounded-[var(--radius-control)] border border-separator bg-surface px-2'
</script>

<template>
  <UiPanel label="Datos de la tarea">
    <template #header>
      <h2 class="panel-label !text-content">
        Datos
      </h2>
    </template>
    <dl class="pb-2">
      <div
        v-for="(row, index) in rows"
        :key="row.key"
        class="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2 px-4 py-1.5 text-[length:var(--text-body)]"
        :class="index % 2 ? 'bg-fill-alt' : ''"
      >
        <dt class="text-secondary">
          {{ row.label }}
        </dt>
        <dd class="min-w-0">
          <!-- Editor del campo. -->
          <template v-if="row.field && editing === row.field">
            <UiSelect
              v-if="row.input === 'select'"
              :model-value="draft"
              :label="row.label"
              default-open
              :options="optionsFor(row.field) ?? []"
              @update:model-value="(value: string | number) => { draft = String(value); void commit() }"
              @update:open="(open: boolean) => { if (!open && editing === row.field) cancel() }"
            />
            <input
              v-else
              v-model="draft"
              :type="row.input === 'date' ? 'date' : 'text'"
              :data-field-editor="row.field"
              :aria-label="row.label"
              :aria-invalid="!!errors[row.field]"
              :class="[FIELD, row.data ? 'data' : '', 'aria-[invalid=true]:border-warning']"
              @keydown.enter.prevent="commit"
              @keydown.esc.prevent="cancel"
              @blur="commit"
            >
          </template>

          <button
            v-else-if="row.field && canEdit"
            type="button"
            :data-field-button="row.field"
            class="-mx-1 flex w-full min-w-0 items-center gap-1.5 rounded-[var(--radius-control)] px-1 text-left hover:bg-fill-hover"
            :aria-label="`${row.label}: ${row.value}. Cambiar`"
            @click="startEditing(row.field)"
          >
            <span
              class="min-w-0 truncate"
              :class="[row.data ? 'data' : '', row.warn ? 'font-semibold text-warning' : 'text-content']"
            >{{ row.value }}</span>
            <span
              v-if="saved === row.field"
              class="inline-flex shrink-0 items-center gap-0.5 text-[length:var(--text-caption)] text-success"
              role="status"
            >
              <Icon
                name="lucide:check"
                class="size-3"
                aria-hidden="true"
              />
              Guardado
            </span>
          </button>

          <span
            v-else
            class="block truncate"
            :class="[row.data ? 'data' : '', row.warn ? 'font-semibold text-warning' : 'text-content']"
          >{{ row.value }}</span>

          <p
            v-if="row.field && errors[row.field]"
            class="mt-0.5 text-[length:var(--text-caption)] text-warning"
            role="alert"
          >
            {{ errors[row.field] }}
          </p>
        </dd>
      </div>
    </dl>
  </UiPanel>
</template>
