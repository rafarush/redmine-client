<script setup lang="ts">
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui'

/**
 * Lista desplegable con la piel del proyecto (sustituye al `<select>` del navegador):
 * mismo campo que los inputs, panel flotante de `FLOATING_PANEL`, flechas, escritura
 * para saltar a una opción y Esc. El valor vacío ('') es una opción válida, p. ej.
 * "Sin asignar"; Reka no admite valores vacíos, así que se traduce por dentro.
 */
const props = withDefaults(defineProps<{
  options: ReadonlyArray<{ value: string | number, label: string, disabled?: boolean }>
  /** Etiqueta accesible cuando no hay un `<label>` que envuelva el campo. */
  label?: string
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  /** Para el modo "editar en línea": se abre al montarse. */
  defaultOpen?: boolean
}>(), { placeholder: 'Elegir…' })

const emit = defineEmits<{ 'update:open': [open: boolean] }>()

const model = defineModel<string | number>({ default: '' })

const EMPTY = '__empty__'
const encode = (value: string | number) => value === '' ? EMPTY : String(value)

const items = computed(() => props.options.map(o => ({ ...o, key: encode(o.value) })))
const current = computed(() => encode(model.value))
const selected = computed(() => items.value.find(i => i.key === current.value))

function update(key: unknown): void {
  const item = items.value.find(i => i.key === key)
  if (item) model.value = item.value
}
</script>

<template>
  <SelectRoot
    :model-value="current"
    :disabled="disabled"
    :default-open="defaultOpen"
    @update:model-value="update"
    @update:open="emit('update:open', $event)"
  >
    <SelectTrigger
      :aria-label="label"
      :aria-invalid="invalid || undefined"
      class="inline-flex min-h-[var(--control-min)] w-full min-w-0 items-center justify-between gap-2 rounded-[var(--radius-control)] border border-separator bg-surface px-2.5 text-left outline-none transition-colors hover:bg-fill-hover focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent data-[state=open]:border-accent disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-warning"
    >
      <span
        class="min-w-0 flex-1 truncate"
        :class="selected ? '' : 'text-secondary'"
      >
        <SelectValue :placeholder="placeholder">
          {{ selected?.label }}
        </SelectValue>
      </span>
      <Icon
        name="lucide:chevrons-up-down"
        class="size-4 shrink-0 text-secondary"
        aria-hidden="true"
      />
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="4"
        :class="[FLOATING_PANEL, 'w-[var(--reka-select-trigger-width)] min-w-40 max-h-[min(20rem,var(--reka-select-content-available-height))] overflow-hidden']"
      >
        <SelectViewport class="max-h-[inherit] overflow-y-auto">
          <SelectItem
            v-for="item in items"
            :key="item.key"
            :value="item.key"
            :disabled="item.disabled"
            :class="[MENU_ITEM, 'cursor-pointer data-[state=checked]:font-medium']"
          >
            <SelectItemText class="min-w-0 flex-1 truncate">
              {{ item.label }}
            </SelectItemText>
            <SelectItemIndicator>
              <Icon
                name="lucide:check"
                class="size-4 shrink-0"
                aria-hidden="true"
              />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
