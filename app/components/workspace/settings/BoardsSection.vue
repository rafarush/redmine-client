<script setup lang="ts">
import { effectiveStatusOrder } from '../../../../shared/workspace/sort'

/**
 * Boards (F2c-T13): en qué orden se agrupan las tareas por estado. Por defecto
 * En curso va siempre primero, luego Nueva / ToDo y después el resto. Dentro de
 * cada estado se sigue ordenando por prioridad y fecha fin.
 */
const session = useSessionStore()
const workspace = useWorkspaceStore()
const toasts = useToastStore()

const statuses = computed(() => session.catalogs.statuses.filter(status => !status.is_closed))
const nameOf = (id: number) => session.catalogs.statuses.find(status => status.id === id)?.name ?? `#${id}`

// La sección se monta al abrir los ajustes, así que parte siempre de lo guardado.
const draft = ref<number[]>(effectiveStatusOrder(statuses.value, workspace.workspace.statusOrder))

function move(index: number, direction: -1 | 1): void {
  const target = index + direction
  if (target < 0 || target >= draft.value.length) return
  const next = [...draft.value]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item!)
  draft.value = next
}

function reset(): void {
  workspace.resetStatusOrder()
  draft.value = effectiveStatusOrder(statuses.value, [])
  toasts.show('Orden restablecido')
}

function save(): void {
  workspace.setStatusOrder(draft.value)
  toasts.show('Ajustes guardados')
}
</script>

<template>
  <section aria-labelledby="settings-boards-title">
    <h3
      id="settings-boards-title"
      class="font-semibold"
    >
      Orden de los estados
    </h3>
    <p class="mt-0.5 text-secondary">
      Las tareas de cada board se agrupan por estado en este orden.
    </p>

    <ol class="mt-3 flex flex-col gap-1">
      <li
        v-for="(id, index) in draft"
        :key="id"
        class="flex min-h-[var(--control-min)] items-center gap-2 rounded-[var(--radius-control)] border border-separator bg-surface px-2"
      >
        <span class="data w-5 text-secondary">{{ index + 1 }}</span>
        <span class="min-w-0 flex-1 truncate">{{ nameOf(id) }}</span>
        <UiButton
          :label="`Subir ${nameOf(id)}`"
          icon="lucide:chevron-up"
          icon-only
          variant="ghost"
          :disabled="index === 0"
          @click="move(index, -1)"
        />
        <UiButton
          :label="`Bajar ${nameOf(id)}`"
          icon="lucide:chevron-down"
          icon-only
          variant="ghost"
          :disabled="index === draft.length - 1"
          @click="move(index, 1)"
        />
      </li>
    </ol>

    <div class="mt-4 flex items-center justify-between gap-2">
      <UiButton
        label="Restablecer orden por defecto"
        icon="lucide:rotate-ccw"
        variant="ghost"
        @click="reset"
      />
      <UiButton
        label="Guardar"
        variant="primary"
        @click="save"
      />
    </div>
  </section>
</template>
