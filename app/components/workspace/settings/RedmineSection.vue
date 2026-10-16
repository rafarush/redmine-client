<script setup lang="ts">
import type { StatusMap } from '../../../../shared/workspace/model'
import { guessStatusMap } from '../../../../shared/workspace/flow'

/**
 * Integración con Redmine (F2c-T06): a qué estado de Redmine lleva cada paso del
 * flujo de la card. Cada Redmine nombra sus estados a su manera; se propone un
 * mapeo por nombre y la persona lo confirma.
 */
const session = useSessionStore()
const workspace = useWorkspaceStore()
const toasts = useToastStore()

// La sección se monta al abrir los ajustes, así que parte siempre de lo guardado.
const draft = ref<StatusMap>({ ...workspace.workspace.statusMap })

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
}
</script>

<template>
  <section aria-labelledby="settings-redmine-title">
    <h3
      id="settings-redmine-title"
      class="font-semibold"
    >
      Estados de Redmine
    </h3>
    <p class="mt-0.5 text-secondary">
      Elige a qué estado de Redmine lleva cada paso.
    </p>

    <div class="mt-3 flex flex-col gap-3">
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

    <div class="mt-4 flex items-center justify-between gap-2">
      <UiButton
        label="Proponer por nombre"
        icon="lucide:wand-sparkles"
        variant="ghost"
        @click="guess"
      />
      <UiButton
        label="Guardar"
        variant="primary"
        @click="save"
      />
    </div>
  </section>
</template>
