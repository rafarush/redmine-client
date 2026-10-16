<script setup lang="ts">
import type { Issue } from '../../../shared/redmine/types'
import { useQueryClient } from '@tanstack/vue-query'
import { explainRejection } from '../../../shared/redmine/issue-actions'
import { movePayload } from '../../../shared/redmine/new-issue'

/**
 * "Mover a proyecto" (F3-T08): destinos activos donde se pueden crear tareas. Si
 * el tipo actual no existe en el destino, hay que elegir otro antes de guardar.
 */
const props = defineProps<{ issue: Issue }>()
const open = defineModel<boolean>('open', { default: false })

const redmine = useRedmine()
const session = useSessionStore()
const toasts = useToastStore()
const queryClient = useQueryClient()

const targets = computed(() => session.catalogs.projects
  .filter(p => p.status === 1 && p.id !== props.issue.project.id && session.can('add_issues', p.id))
  .sort((a, b) => a.name.localeCompare(b.name, 'es')))

const targetId = ref('')
const trackerId = ref('')
const saving = ref(false)

watch(open, (value) => {
  if (!value) return
  targetId.value = targets.value[0] ? String(targets.value[0].id) : ''
  trackerId.value = ''
})

const target = computed(() => targets.value.find(p => String(p.id) === targetId.value))
const plan = computed(() => target.value
  ? movePayload(target.value, props.issue.tracker.id, trackerId.value ? Number(trackerId.value) : undefined)
  : undefined)
const needsTracker = computed(() => !!target.value && !(target.value.trackers ?? []).some(t => t.id === props.issue.tracker.id) && (target.value.trackers ?? []).length > 0)

watch(targetId, () => {
  trackerId.value = ''
})

async function move(): Promise<void> {
  const current = plan.value
  if (!current?.ok || saving.value || !target.value) return
  saving.value = true
  try {
    await redmine.updateIssue(props.issue.id, current.payload)
    open.value = false
    toasts.show(`#${props.issue.id} movida a ${target.value.name}`)
    await queryClient.invalidateQueries({ queryKey: ['issues'] })
  }
  catch (error) {
    toasts.show(`No se pudo mover la tarea: ${explainRejection(error)}`)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Mover a proyecto"
    :description="`#${issue.id} está en ${issue.project.name}`"
  >
    <p
      v-if="targets.length === 0"
      class="text-secondary"
    >
      No hay otro proyecto donde puedas crear tareas.
    </p>
    <form
      v-else
      class="flex flex-col gap-4"
      @submit.prevent="move"
    >
      <label class="flex flex-col gap-1">
        <span class="panel-label">Proyecto de destino</span>
        <UiSelect
          v-model="targetId"
          :options="targets.map(p => ({ value: String(p.id), label: p.name }))"
        />
      </label>
      <label
        v-if="needsTracker"
        class="flex flex-col gap-1"
      >
        <span class="panel-label">Tipo en el destino</span>
        <span class="text-[length:var(--text-caption)] text-warning">{{ target?.name }} no tiene el tipo "{{ issue.tracker.name }}": elige otro.</span>
        <UiSelect
          v-model="trackerId"
          placeholder="Elegir tipo…"
          :options="(target?.trackers ?? []).map(t => ({ value: String(t.id), label: t.name }))"
        />
      </label>
      <button
        type="submit"
        class="sr-only"
      >
        Mover tarea
      </button>
    </form>
    <template #footer>
      <UiButton
        label="Cancelar"
        variant="ghost"
        @click="open = false"
      />
      <UiButton
        :label="saving ? 'Moviendo…' : 'Mover tarea'"
        variant="primary"
        :disabled="saving || !plan?.ok"
        @click="move"
      />
    </template>
  </UiDialog>
</template>
