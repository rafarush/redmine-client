<script setup lang="ts" generic="T extends string">
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'

/**
 * Control segmentado de la HIG: elige una opción entre 2–4 excluyentes
 * (p. ej. el modo del kanban). Flechas para moverse, siempre hay una elegida.
 */
defineProps<{
  /** Etiqueta accesible del grupo. */
  label: string
  options: ReadonlyArray<{ value: T, label: string, icon?: string }>
}>()

const model = defineModel<T>({ required: true })

/** ToggleGroup permite deseleccionar; un segmentado no. */
function select(value: unknown): void {
  if (typeof value === 'string' && value) model.value = value as T
}
</script>

<template>
  <ToggleGroupRoot
    type="single"
    :model-value="model"
    :aria-label="label"
    class="inline-flex rounded-[var(--radius-control)] bg-fill-selected p-0.5"
    @update:model-value="select"
  >
    <ToggleGroupItem
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      class="inline-flex min-h-[calc(var(--control-min)-4px)] items-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] px-3 text-[length:var(--text-body)] font-medium text-secondary transition-[background-color,color,box-shadow] duration-150 hover:text-content data-[state=on]:bg-raised data-[state=on]:text-content data-[state=on]:shadow-panel"
    >
      <Icon
        v-if="option.icon"
        :name="option.icon"
        class="size-4 shrink-0"
        aria-hidden="true"
      />
      {{ option.label }}
    </ToggleGroupItem>
  </ToggleGroupRoot>
</template>
