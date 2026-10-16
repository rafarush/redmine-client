<script setup lang="ts">
import type { Issue } from '../../../shared/redmine/types'
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { topActivities } from '../../../shared/time/activities'
import { describeDuration, formatHours, parseDuration } from '../../../shared/time/duration'
import { addDays } from '../../../shared/time/timesheet'

/**
 * "Registrar tiempo" (F4-T03, `02-diseno.md › El popover de tiempo`): una sola
 * instancia por pantalla, anclada al ⏱ de la fila (o a la fila con `T`). El foco
 * entra en la duración y se ve cómo se entendió; chips con las 3 actividades más
 * usadas en el proyecto; Hoy / Ayer / otra fecha; Enter registra. Si se cierra sin
 * guardar, lo escrito se queda como borrador de esa tarea.
 */
const props = defineProps<{
  issue: Issue | null
  anchor: Element | null
}>()
const open = defineModel<boolean>('open', { default: false })

const session = useSessionStore()
const toasts = useToastStore()
const { create, remove } = useTimeEntryMutations()

/** Mis registros de los últimos 60 días, para saber qué actividades uso en cada proyecto. */
const recent = useMyTimeEntries(() => addDays(today(), -60), () => today())

interface Draft { duration: string, activity?: number, day: string, comment: string }
const drafts = useState<Record<number, Draft>>('log-time-drafts', () => ({}))

const duration = ref('')
const activity = ref<number | undefined>()
const day = ref(today())
const comment = ref('')
const durationInput = useTemplateRef<HTMLInputElement>('durationInput')

const activities = computed(() => session.catalogs.activities.filter(a => a.active !== false))
const suggestion = computed(() => props.issue
  ? topActivities(recent.data.value ?? [], props.issue.project.id, activities.value)
  : { top: [], preferred: undefined })

watch(open, async (value) => {
  const issue = props.issue
  if (!value || !issue) return
  const draft = drafts.value[issue.id]
  duration.value = draft?.duration ?? ''
  activity.value = draft?.activity ?? suggestion.value.preferred
  day.value = draft?.day ?? today()
  comment.value = draft?.comment ?? ''
  await nextTick()
  durationInput.value?.focus()
})

// Si las actividades llegan después de abrir, se preselecciona la sugerida.
watch(() => suggestion.value.preferred, (preferred) => {
  if (open.value && activity.value === undefined) activity.value = preferred
})

/** Cerrar sin registrar guarda el borrador de esa tarea (`popovers.md`). */
watch(open, (value) => {
  const issue = props.issue
  if (value || !issue) return
  if (duration.value.trim() || comment.value.trim()) {
    drafts.value = { ...drafts.value, [issue.id]: { duration: duration.value, activity: activity.value, day: day.value, comment: comment.value } }
  }
})

const hint = computed(() => describeDuration(duration.value))
const hours = computed(() => parseDuration(duration.value))
const otherActivities = computed(() => activities.value.filter(a => !suggestion.value.top.some(t => t.id === a.id)))
const yesterday = computed(() => addDays(today(), -1))

async function submit(): Promise<void> {
  const issue = props.issue
  if (!issue || hours.value === null || create.isPending.value) return
  const logged = hours.value
  const note = comment.value.trim()
  const { [issue.id]: _, ...rest } = drafts.value
  drafts.value = rest
  duration.value = ''
  comment.value = ''
  open.value = false
  try {
    const entry = await create.mutateAsync({
      issue_id: issue.id,
      project_id: issue.project.id,
      hours: logged,
      spent_on: day.value,
      activity_id: activity.value,
      comments: note || undefined,
    })
    toasts.show(`Tiempo registrado · ${formatHours(logged)} en #${issue.id}`, { label: 'Deshacer', run: () => remove.mutate(entry) })
  }
  catch {
    // El aviso del error ya lo da la mutación.
  }
}

const CHIP = 'min-h-8 rounded-full border px-3 text-[length:var(--text-caption)] font-medium transition-colors'
const FIELD = 'min-h-[var(--control-min)] w-full rounded-[var(--radius-control)] border border-separator bg-surface px-2.5'
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverAnchor
      v-if="anchor"
      :reference="anchor"
    />
    <PopoverPortal>
      <PopoverContent
        v-if="issue"
        side="bottom"
        align="end"
        :side-offset="6"
        :collision-padding="12"
        :class="[FLOATING_PANEL, 'w-80 p-4']"
        :aria-label="`Registrar tiempo en la tarea #${issue.id}`"
      >
        <form
          class="flex flex-col gap-3"
          @submit.prevent="submit"
        >
          <p class="flex items-baseline gap-2 font-semibold">
            Registrar tiempo
            <span class="data font-normal text-secondary">#{{ issue.id }}</span>
          </p>

          <label class="flex items-center gap-2">
            <span class="sr-only">Duración</span>
            <input
              ref="durationInput"
              v-model="duration"
              type="text"
              inputmode="decimal"
              placeholder="1h30"
              autocomplete="off"
              :aria-invalid="hint?.hours === null"
              aria-describedby="log-time-hint"
              :class="[FIELD, 'data text-[length:var(--text-title)] aria-[invalid=true]:border-warning']"
            >
            <span
              id="log-time-hint"
              class="w-24 shrink-0 text-[length:var(--text-caption)]"
              :class="hint?.hours === null ? 'text-warning' : 'text-secondary'"
              aria-live="polite"
            >{{ hint ? (hint.hours === null ? 'No se entiende' : hint.label) : '1h30, 1:30, 1,5' }}</span>
          </label>

          <fieldset class="flex flex-col gap-1.5">
            <legend class="panel-label pb-1">
              Actividad
            </legend>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="a in suggestion.top"
                :key="a.id"
                type="button"
                :aria-pressed="activity === a.id"
                :class="[CHIP, activity === a.id ? 'border-content bg-content text-surface' : 'border-separator hover:bg-fill-hover']"
                @click="activity = a.id"
              >
                {{ a.name }}
              </button>
              <UiSelect
                v-if="otherActivities.length > 0"
                class="!w-auto"
                label="Otra actividad"
                placeholder="Otra"
                :model-value="otherActivities.some(a => a.id === activity) ? activity : ''"
                :options="otherActivities.map(a => ({ value: a.id, label: a.name }))"
                @update:model-value="activity = Number($event) || undefined"
              />
            </div>
          </fieldset>

          <fieldset class="flex flex-col gap-1.5">
            <legend class="panel-label pb-1">
              Fecha
            </legend>
            <div class="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                :aria-pressed="day === today()"
                :class="[CHIP, day === today() ? 'border-content bg-content text-surface' : 'border-separator hover:bg-fill-hover']"
                @click="day = today()"
              >
                Hoy
              </button>
              <button
                type="button"
                :aria-pressed="day === yesterday"
                :class="[CHIP, day === yesterday ? 'border-content bg-content text-surface' : 'border-separator hover:bg-fill-hover']"
                @click="day = yesterday"
              >
                Ayer
              </button>
              <input
                v-model="day"
                type="date"
                aria-label="Otra fecha"
                :max="today()"
                class="data min-h-8 rounded-[var(--radius-control)] border border-separator bg-surface px-2 text-[length:var(--text-caption)]"
              >
            </div>
          </fieldset>

          <label class="flex flex-col gap-1">
            <span class="panel-label">Comentario</span>
            <input
              v-model="comment"
              type="text"
              placeholder="Opcional"
              :class="FIELD"
            >
          </label>

          <div class="flex justify-end gap-2">
            <UiButton
              label="Cancelar"
              variant="ghost"
              @click="open = false"
            />
            <UiButton
              type="submit"
              label="Registrar"
              variant="primary"
              :disabled="hours === null"
            />
          </div>
        </form>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
