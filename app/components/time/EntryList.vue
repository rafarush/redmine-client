<script setup lang="ts">
import type { TimeEntry } from '../../../shared/redmine/types'
import { describeDuration, formatHours, parseDuration } from '../../../shared/time/duration'

/**
 * Registros de la semana (F4-T07), del más reciente al más antiguo. Editar abre un
 * diálogo corto; borrar deja "Deshacer" en el toast, así que no pide confirmación.
 * Las acciones solo aparecen si se puede editar ese registro: los propios con
 * `edit_own_time_entries`, cualquiera con `edit_time_entries`.
 */
const props = defineProps<{
  entries: TimeEntry[]
  /** Asunto de cada tarea, si ya se conoce. */
  subjects: Map<number, string>
  days: string[]
}>()

const emit = defineEmits<{ remove: [entry: TimeEntry] }>()

const session = useSessionStore()
const { update } = useTimeEntryMutations()

const sorted = computed(() => [...props.entries].sort((a, b) =>
  b.spent_on.localeCompare(a.spent_on) || b.created_on.localeCompare(a.created_on)))

function canEdit(entry: TimeEntry): boolean {
  if (entry.id < 0) return false // provisional, aún sin id de Redmine
  const own = entry.user.id === session.user?.id
  return session.can('edit_time_entries', entry.project.id) || (own && session.can('edit_own_time_entries', entry.project.id))
}

const dayFormat = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short' })
const formatDay = (day: string) => dayFormat.format(new Date(`${day}T00:00:00`)).replaceAll('.', '')

// ---------------------------------------------------------------- edición

const editing = ref<TimeEntry | null>(null)
const open = computed({
  get: () => editing.value !== null,
  set: (value: boolean) => {
    if (!value) editing.value = null
  },
})
const form = reactive({ hours: '', spent_on: '', activity_id: 0, comments: '' })

function edit(entry: TimeEntry): void {
  editing.value = entry
  form.hours = formatHours(entry.hours)
  form.spent_on = entry.spent_on
  form.activity_id = entry.activity.id
  form.comments = entry.comments ?? ''
}

const hint = computed(() => describeDuration(form.hours))
const activities = computed(() => session.catalogs.activities.filter(a => a.active !== false))

function save(): void {
  const entry = editing.value
  const hours = parseDuration(form.hours)
  if (!entry || hours === null || !form.spent_on) return
  update.mutate({
    entry,
    changes: { hours, spent_on: form.spent_on, activity_id: form.activity_id || undefined, comments: form.comments },
  })
  editing.value = null
}

const FIELD = 'min-h-[var(--control-min)] rounded-[var(--radius-control)] border border-separator bg-surface px-2.5'
</script>

<template>
  <UiPanel label="Registros de la semana">
    <template #header>
      <h2 class="panel-label !text-content">
        Registros
      </h2>
      <span class="data ml-auto text-[length:var(--text-caption)] text-secondary">{{ entries.length }}</span>
    </template>

    <ol
      v-if="sorted.length > 0"
      class="flex flex-col"
    >
      <li
        v-for="(entry, index) in sorted"
        :key="entry.id"
        class="group grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-1.5 wide:grid-cols-[6.5rem_minmax(0,1fr)_9rem_4rem_auto]"
        :class="index % 2 ? 'bg-fill-alt' : ''"
      >
        <span class="data text-secondary">{{ formatDay(entry.spent_on) }}</span>
        <span class="min-w-0">
          <span class="flex min-w-0 items-baseline gap-2">
            <NuxtLink
              v-if="entry.issue"
              :to="`/issues/${entry.issue.id}`"
              class="data shrink-0 text-secondary hover:underline"
            >#{{ entry.issue.id }}</NuxtLink>
            <span class="truncate">{{ entry.issue ? subjects.get(entry.issue.id) ?? entry.project.name : `${entry.project.name} · sin tarea` }}</span>
          </span>
          <span
            v-if="entry.comments"
            class="block truncate text-[length:var(--text-caption)] text-secondary"
          >{{ entry.comments }}</span>
        </span>
        <span class="hidden truncate text-secondary wide:block">{{ entry.activity.name }}</span>
        <span class="data hidden text-right font-semibold wide:block">{{ formatHours(entry.hours) }}</span>
        <span class="flex items-center justify-end gap-1">
          <span class="data font-semibold wide:hidden">{{ formatHours(entry.hours) }}</span>
          <template v-if="canEdit(entry)">
            <UiButton
              :label="`Editar el registro de ${formatHours(entry.hours)} del ${formatDay(entry.spent_on)}`"
              icon="lucide:pencil"
              icon-only
              variant="ghost"
              @click="edit(entry)"
            />
            <UiButton
              :label="`Borrar el registro de ${formatHours(entry.hours)} del ${formatDay(entry.spent_on)}`"
              icon="lucide:trash-2"
              icon-only
              variant="ghost"
              @click="emit('remove', entry)"
            />
          </template>
        </span>
      </li>
    </ol>
    <p
      v-else
      class="px-4 pb-4 text-secondary"
    >
      Sin registros en esta semana.
    </p>

    <UiDialog
      v-model:open="open"
      title="Editar registro"
      :description="editing?.issue ? `Tarea #${editing.issue.id}` : editing?.project.name"
    >
      <form
        class="flex flex-col gap-4"
        @submit.prevent="save"
      >
        <label class="flex flex-col gap-1">
          <span class="panel-label">Tiempo</span>
          <input
            v-model="form.hours"
            type="text"
            inputmode="decimal"
            :aria-invalid="hint?.hours === null"
            :class="[FIELD, 'data text-[length:var(--text-title)] aria-[invalid=true]:border-warning']"
          >
          <span
            class="text-[length:var(--text-caption)]"
            :class="hint?.hours === null ? 'text-warning' : 'text-secondary'"
          >{{ hint?.label ?? 'Escribe "1h 30", "45 min" o "1,5".' }}</span>
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1">
            <span class="panel-label">Fecha</span>
            <input
              v-model="form.spent_on"
              type="date"
              :class="[FIELD, 'data']"
            >
          </label>
          <label class="flex flex-col gap-1">
            <span class="panel-label">Actividad</span>
            <select
              v-model.number="form.activity_id"
              :class="FIELD"
            >
              <option
                v-for="activity in activities"
                :key="activity.id"
                :value="activity.id"
              >
                {{ activity.name }}
              </option>
            </select>
          </label>
        </div>
        <label class="flex flex-col gap-1">
          <span class="panel-label">Comentario</span>
          <input
            v-model="form.comments"
            type="text"
            :class="FIELD"
          >
        </label>
        <button
          type="submit"
          class="sr-only"
        >
          Guardar cambios
        </button>
      </form>
      <template #footer>
        <UiButton
          label="Cancelar"
          variant="ghost"
          @click="editing = null"
        />
        <UiButton
          label="Guardar cambios"
          variant="primary"
          :disabled="hint?.hours == null || !form.spent_on"
          @click="save"
        />
      </template>
    </UiDialog>
  </UiPanel>
</template>
