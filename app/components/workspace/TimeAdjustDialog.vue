<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { explainRejection } from '../../../shared/redmine/issue-actions'
import { formatDuration, parseDuration } from '../../../shared/time/duration'

/**
 * Ajustar el tiempo de una tarea (F2c-T06): corrige lo que midió el cronómetro o
 * añade más. Se escribe como se dice ("1h 30", "45 min", "1,5") y se ve cómo se
 * entendió antes de guardar.
 */
const flow = useCardFlow()
const redmine = useRedmine()
const workspace = useWorkspaceStore()
const toasts = useToastStore()
const queryClient = useQueryClient()

/** "Registrar tiempo…" del menú crea un registro nuevo; si no, se ajusta el último. */
const logging = computed(() => flow.logging.value !== null)
const issue = computed(() => flow.logging.value ?? flow.adjusting.value)
const open = computed({
  get: () => issue.value !== null,
  set: (value: boolean) => {
    if (!value) {
      flow.adjusting.value = null
      flow.logging.value = null
    }
  },
})

const logged = computed(() => issue.value && !logging.value ? workspace.loggedFor(issue.value.id) : undefined)
const corrected = ref('')
const extra = ref('')
const saving = ref(false)

watch(issue, (current) => {
  if (!current) return
  corrected.value = logged.value ? formatDuration(logged.value.hours) : ''
  extra.value = ''
})

const correctedHours = computed(() => corrected.value.trim() ? parseDuration(corrected.value) : null)
const extraHours = computed(() => extra.value.trim() ? parseDuration(extra.value) : null)
const correctedInvalid = computed(() => corrected.value.trim() !== '' && correctedHours.value === null)
const extraInvalid = computed(() => extra.value.trim() !== '' && extraHours.value === null)

const changesLogged = computed(() => !!logged.value && correctedHours.value !== null && Math.abs(correctedHours.value - logged.value.hours) > 0.004)
const canSave = computed(() => !correctedInvalid.value && !extraInvalid.value && (changesLogged.value || extraHours.value !== null || (!logged.value && correctedHours.value !== null)))

async function save(): Promise<void> {
  const current = issue.value
  if (!current || !canSave.value) return
  saving.value = true
  try {
    const entry = logged.value
    if (entry && changesLogged.value) {
      await redmine.updateTimeEntry(entry.timeEntryId, { hours: correctedHours.value })
      workspace.rememberLogged({ ...entry, hours: correctedHours.value! })
    }
    else if (!entry && correctedHours.value !== null) {
      const created = await redmine.createTimeEntry({ issue_id: current.id, hours: correctedHours.value, activity_id: flow.defaultActivity(), spent_on: today() })
      workspace.rememberLogged({ issueId: current.id, timeEntryId: created.id, hours: created.hours })
    }
    if (extraHours.value !== null) {
      await redmine.createTimeEntry({ issue_id: current.id, hours: extraHours.value, activity_id: flow.defaultActivity(), spent_on: today() })
    }
    void queryClient.invalidateQueries({ queryKey: ['time-entries'] })
    void queryClient.invalidateQueries({ queryKey: ['issues'] })
    toasts.show(logging.value ? 'Tiempo registrado' : 'Tiempo ajustado')
    open.value = false
  }
  catch (error) {
    toasts.show(explainRejection(error))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    :title="issue ? `${logging ? 'Registrar tiempo en' : 'Tiempo de'} #${issue.id}` : 'Tiempo'"
    :description="issue?.subject"
    :width="24"
  >
    <form
      class="flex flex-col gap-4"
      @submit.prevent="save"
    >
      <label class="flex flex-col gap-1">
        <span class="panel-label">{{ logged ? 'Registrado al completar' : 'Tiempo dedicado' }}</span>
        <input
          v-model="corrected"
          type="text"
          inputmode="decimal"
          placeholder="1h 30"
          :aria-invalid="correctedInvalid"
          class="data min-h-[var(--control-min)] rounded-[var(--radius-control)] border border-separator bg-surface px-2.5 text-[length:var(--text-title)] aria-[invalid=true]:border-warning"
        >
        <span
          class="text-[length:var(--text-caption)]"
          :class="correctedInvalid ? 'text-warning' : 'text-secondary'"
        >
          {{ correctedInvalid ? 'No se entiende. Prueba con "1h 30", "45 min" o "1,5".' : correctedHours !== null ? `Se guardará como ${formatDuration(correctedHours)}` : 'Escribe "1h 30", "45 min" o "1,5".' }}
        </span>
      </label>

      <label
        v-if="!logging"
        class="flex flex-col gap-1"
      >
        <span class="panel-label">Añadir más</span>
        <input
          v-model="extra"
          type="text"
          inputmode="decimal"
          placeholder="30 min"
          :aria-invalid="extraInvalid"
          class="data min-h-[var(--control-min)] rounded-[var(--radius-control)] border border-separator bg-surface px-2.5 aria-[invalid=true]:border-warning"
        >
        <span
          v-if="extra.trim()"
          class="text-[length:var(--text-caption)]"
          :class="extraInvalid ? 'text-warning' : 'text-secondary'"
        >
          {{ extraInvalid ? 'No se entiende.' : `Nuevo registro de ${formatDuration(extraHours!)}` }}
        </span>
      </label>
      <button
        type="submit"
        class="sr-only"
      >
        Guardar tiempo
      </button>
    </form>

    <template #footer>
      <UiButton
        label="Cancelar"
        variant="ghost"
        @click="open = false"
      />
      <UiButton
        :label="logging ? 'Registrar tiempo' : 'Guardar tiempo'"
        variant="primary"
        :disabled="!canSave || saving"
        @click="save"
      />
    </template>
  </UiDialog>
</template>
