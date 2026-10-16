<script setup lang="ts">
import type { StatusMap } from '../../../shared/workspace/model'
import { guessStatusMap } from '../../../shared/workspace/flow'

/**
 * Ajustes del workspace (F2c-T06): a qué estado de Redmine lleva cada paso del
 * flujo de la card. Cada Redmine nombra sus estados a su manera; se propone un
 * mapeo por nombre y la persona lo confirma.
 */
const open = defineModel<boolean>('open', { default: false })

const session = useSessionStore()
const workspace = useWorkspaceStore()
const toasts = useToastStore()

const draft = ref<StatusMap>({})
watch(open, (isOpen) => {
  if (isOpen) draft.value = { ...workspace.workspace.statusMap }
})

const STEPS: ReadonlyArray<{ key: keyof StatusMap, label: string, hint: string }> = [
  { key: 'inProgress', label: 'En curso', hint: 'Primer doble clic: arranca el cronómetro.' },
  { key: 'done', label: 'Completada', hint: 'Segundo doble clic: registra el tiempo medido.' },
  { key: 'rtqa', label: 'RTQA', hint: 'El botón RTQA de una tarea completada.' },
]

function guess(): void {
  const guessed = guessStatusMap(session.catalogs.statuses)
  draft.value = {
    inProgress: guessed.inProgress ?? draft.value.inProgress,
    done: guessed.done ?? draft.value.done,
    rtqa: guessed.rtqa ?? draft.value.rtqa,
  }
}

function setStep(key: keyof StatusMap, value: string): void {
  draft.value = { ...draft.value, [key]: value ? Number(value) : undefined }
}

function save(): void {
  workspace.setStatusMap(draft.value)
  toasts.show('Ajustes guardados')
  open.value = false
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Ajustes del workspace"
    description="Elige a qué estado de Redmine lleva cada paso."
    :width="26"
  >
    <div class="flex flex-col gap-3">
      <label
        v-for="step in STEPS"
        :key="step.key"
        class="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5"
      >
        <span class="font-semibold">{{ step.label }}</span>
        <select
          :value="draft[step.key] ?? ''"
          class="min-h-[var(--control-min)] rounded-[var(--radius-control)] border border-separator bg-surface px-2"
          @change="setStep(step.key, ($event.target as HTMLSelectElement).value)"
        >
          <option value="">
            Sin elegir
          </option>
          <option
            v-for="status in session.catalogs.statuses"
            :key="status.id"
            :value="status.id"
          >
            {{ status.name }}{{ status.is_closed ? ' (cerrada)' : '' }}
          </option>
        </select>
        <span class="col-start-2 text-[length:var(--text-caption)] text-secondary">{{ step.hint }}</span>
      </label>
    </div>

    <template #footer>
      <UiButton
        label="Proponer por nombre"
        icon="lucide:wand-sparkles"
        variant="ghost"
        class="mr-auto"
        @click="guess"
      />
      <UiButton
        label="Guardar"
        variant="primary"
        @click="save"
      />
    </template>
  </UiDialog>
</template>
