<script setup lang="ts">
import type { TimeEntry } from '../../../shared/redmine/types'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { describeDuration, formatHours, parseDuration } from '../../../shared/time/duration'
import { sumHours } from '../../../shared/time/timesheet'

/**
 * Celda del parte semanal (F4-T06). Con una entrada o ninguna es un campo: se
 * escribe la duración como se dice ("1h30", "45", "1,5") y Enter guarda; vaciarla
 * borra el registro. Con varias entradas no se adivina cuál tocar: es un botón que
 * abre el desglose, donde cada una se ajusta o se borra por separado.
 */
const props = defineProps<{
  entries: TimeEntry[]
  /** Etiqueta accesible: "Tarea #12, lunes 12 oct". */
  label: string
  /** `fila-columna`, para moverse con las flechas. */
  cell: string
  editable: boolean
}>()

const emit = defineEmits<{
  /** Horas escritas en una celda de 0 o 1 entradas (`null` = vaciada). */
  save: [hours: number | null]
  update: [entry: TimeEntry, hours: number]
  remove: [entry: TimeEntry]
  add: [hours: number]
  /** Lo que se entiende de lo escrito, para mostrarlo bajo el parte. */
  hint: [text: string]
}>()

const total = computed(() => sumHours(props.entries))
const shown = computed(() => total.value ? formatHours(total.value) : '')
const text = ref(shown.value)
const invalid = ref(false)
watch(shown, (value) => {
  text.value = value
  invalid.value = false
})

function onInput(): void {
  invalid.value = false
  emit('hint', describeDuration(text.value)?.label ?? '')
}

/** Guarda si cambió. Lo que no se entiende se queda marcado y no se envía. */
function commit(): void {
  const value = text.value.trim()
  if (value === shown.value) return
  const hours = value ? parseDuration(value) : null
  if (value && hours === null) {
    invalid.value = true
    emit('hint', describeDuration(value)?.label ?? '')
    return
  }
  emit('save', hours)
  emit('hint', '')
}

function revert(): void {
  text.value = shown.value
  invalid.value = false
  emit('hint', '')
}

// ---------------------------------------------------------------- desglose

const open = ref(false)
const drafts = ref<Record<number, string>>({})
const extra = ref('')
watch(open, (value) => {
  if (value) {
    drafts.value = Object.fromEntries(props.entries.map(e => [e.id, formatHours(e.hours)]))
    extra.value = ''
  }
})

function saveEntry(entry: TimeEntry): void {
  const hours = parseDuration(drafts.value[entry.id] ?? '')
  if (hours !== null && Math.abs(hours - entry.hours) > 0.004) emit('update', entry, hours)
}

function addEntry(): void {
  const hours = parseDuration(extra.value)
  if (hours === null) return
  emit('add', hours)
  extra.value = ''
}

const CELL = 'data h-9 w-full rounded-[var(--radius-control)] text-center tabular-nums'
</script>

<template>
  <div
    v-if="!editable"
    :class="[CELL, 'grid place-items-center', total ? 'text-content' : 'text-tertiary']"
    :aria-label="`${label}: ${shown || 'sin tiempo'}`"
  >
    {{ shown || '·' }}
  </div>

  <input
    v-else-if="entries.length <= 1"
    v-model="text"
    type="text"
    inputmode="decimal"
    autocomplete="off"
    :data-cell="cell"
    :aria-label="label"
    :aria-invalid="invalid"
    :class="[CELL, 'border border-transparent bg-transparent outline-none transition-colors hover:border-separator focus:border-separator focus:bg-surface aria-[invalid=true]:border-warning aria-[invalid=true]:text-warning']"
    placeholder="·"
    @input="onInput"
    @focus="($event.target as HTMLInputElement).select()"
    @keydown.enter.prevent="commit"
    @keydown.esc.prevent="revert"
    @change="commit"
  >

  <PopoverRoot
    v-else
    v-model:open="open"
  >
    <PopoverTrigger
      :data-cell="cell"
      :aria-label="`${label}: ${shown} en ${entries.length} registros. Ver desglose`"
      :class="[CELL, 'inline-flex items-center justify-center gap-1 hover:bg-fill-hover data-[state=open]:bg-fill-selected']"
    >
      {{ shown }}
      <span
        class="text-[length:var(--text-caption)] text-secondary"
        aria-hidden="true"
      >×{{ entries.length }}</span>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        align="center"
        :side-offset="6"
        :class="[FLOATING_PANEL, 'w-72 p-3']"
      >
        <p class="panel-label pb-2">
          {{ label }}
        </p>
        <ul class="flex flex-col gap-1">
          <li
            v-for="entry in entries"
            :key="entry.id"
            class="flex items-center gap-2"
          >
            <input
              v-model="drafts[entry.id]"
              type="text"
              inputmode="decimal"
              :aria-label="`Horas del registro de ${entry.activity.name}`"
              class="data h-8 w-16 rounded-[var(--radius-control)] border border-separator bg-surface px-2 text-center"
              @keydown.enter.prevent="saveEntry(entry)"
              @change="saveEntry(entry)"
            >
            <span class="min-w-0 flex-1 truncate text-[length:var(--text-caption)] text-secondary">
              {{ entry.activity.name }}{{ entry.comments ? ` · ${entry.comments}` : '' }}
            </span>
            <UiButton
              :label="`Borrar el registro de ${formatHours(entry.hours)}`"
              icon="lucide:trash-2"
              icon-only
              variant="ghost"
              @click="emit('remove', entry)"
            />
          </li>
        </ul>
        <form
          class="mt-2 flex items-center gap-2 border-t border-separator pt-2"
          @submit.prevent="addEntry"
        >
          <input
            v-model="extra"
            type="text"
            inputmode="decimal"
            placeholder="30 min"
            aria-label="Horas del nuevo registro"
            class="data h-8 w-16 rounded-[var(--radius-control)] border border-separator bg-surface px-2 text-center"
          >
          <UiButton
            type="submit"
            label="Añadir registro"
            icon="lucide:plus"
            variant="ghost"
            :disabled="parseDuration(extra) === null"
          />
        </form>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
