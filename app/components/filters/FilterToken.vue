<script setup lang="ts">
import type { FieldMeta, FilterOption } from '../../../shared/redmine/filter-fields'
import type { FilterCondition } from '../../../shared/redmine/filters'
import {
  ListboxContent,
  ListboxFilter,
  ListboxItem,
  ListboxRoot,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui'
import { dateRange } from '../../../shared/redmine/filter-fields'
import { relativeValue, RELATIVE_PERIODS } from '../../../shared/redmine/filters'

/**
 * Un token de la frase: el texto de la condición y, al abrirlo, su editor
 * (lista con búsqueda, atajos y rango de fechas, o un campo de texto).
 */
const props = defineProps<{
  condition: FilterCondition
  meta: FieldMeta
  /** La condición dicha en palabras, p. ej. "asignadas a mí". */
  text: string
  options: FilterOption[]
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  'toggle': [value: string]
  'set': [operator: FilterCondition['operator'], values: string[]]
  'remove': []
}>()

const PERIOD_LABELS: Record<string, string> = {
  today: 'Hoy',
  yesterday: 'Ayer',
  this_week: 'Esta semana',
  last_week: 'La semana pasada',
  this_month: 'Este mes',
  last_month: 'El mes pasado',
}

const search = ref('')
const shown = computed(() => {
  const needle = search.value.trim().toLowerCase()
  return needle ? props.options.filter(o => o.label.toLowerCase().includes(needle)) : props.options
})

const from = ref('')
const to = ref('')
const textValue = ref('')

watch(() => props.open, (open) => {
  if (!open) return
  search.value = ''
  const [a = '', b = ''] = props.condition.values
  from.value = props.condition.operator === '<=' || a.startsWith('@') ? '' : a
  to.value = props.condition.operator === '<=' ? a : a.startsWith('@') ? '' : b
  textValue.value = props.condition.values[0] ?? ''
})

function applyRange(): void {
  const { operator, values } = dateRange(from.value, to.value)
  emit('set', operator, values)
}

function submitText(): void {
  emit('set', '~', [textValue.value.trim()])
  emit('update:open', false)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Backspace' && event.key !== 'Delete') return
  event.preventDefault()
  emit('remove')
}
</script>

<template>
  <PopoverRoot
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <div class="inline-flex shrink-0 items-center rounded-full border border-separator bg-raised text-[length:var(--text-body)]">
      <PopoverTrigger
        class="min-h-[var(--control-min)] rounded-l-full pl-3 pr-1.5 text-content hover:bg-surface"
        :data-filter-token="condition.field"
        @keydown="onKeydown"
      >
        <span class="text-secondary">{{ meta.label }}:</span>
        {{ text }}
      </PopoverTrigger>
      <button
        type="button"
        class="grid min-h-[var(--control-min)] min-w-[var(--control-min)] place-items-center rounded-r-full text-secondary hover:bg-surface hover:text-content"
        :aria-label="`Quitar el filtro ${meta.label}`"
        @click="emit('remove')"
      >
        <Icon
          name="lucide:x"
          class="size-3.5"
          aria-hidden="true"
        />
      </button>
    </div>

    <PopoverPortal>
      <PopoverContent
        align="start"
        :side-offset="6"
        class="z-50 w-72 rounded-[var(--radius-surface)] border border-separator bg-raised p-2 shadow-lg"
      >
        <!-- Lista con búsqueda y selección múltiple. El estado vive en la frase, no en el Listbox. -->
        <ListboxRoot
          v-if="meta.kind === 'list'"
          multiple
          :model-value="condition.values"
        >
          <ListboxFilter
            v-model="search"
            placeholder="Buscar…"
            :aria-label="`Buscar en ${meta.label}`"
            class="mb-1 w-full rounded-[var(--radius-control)] border border-separator bg-surface px-2 py-1 text-[length:var(--text-body)] text-content"
          />
          <ListboxContent class="max-h-64 overflow-y-auto">
            <ListboxItem
              v-for="option in shown"
              :key="option.value"
              :value="option.value"
              class="flex min-h-[var(--control-min)] cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-2 text-[length:var(--text-body)] text-content data-[highlighted]:bg-surface"
              @select.prevent="emit('toggle', option.value)"
            >
              <Icon
                :name="condition.values.includes(option.value) ? 'lucide:check-square' : 'lucide:square'"
                class="size-4 shrink-0 text-secondary"
                aria-hidden="true"
              />
              {{ option.label }}
            </ListboxItem>
            <p
              v-if="shown.length === 0"
              class="px-2 py-3 text-[length:var(--text-body)] text-secondary"
            >
              Nada coincide con «{{ search }}».
            </p>
          </ListboxContent>
        </ListboxRoot>

        <!-- Fechas: atajos relativos y rango. -->
        <div
          v-else-if="meta.kind === 'date'"
          class="flex flex-col gap-2"
        >
          <div class="flex flex-wrap gap-1">
            <button
              v-for="period in RELATIVE_PERIODS"
              :key="period"
              type="button"
              class="min-h-[var(--control-min)] rounded-full border border-separator px-3 text-[length:var(--text-body)] text-content hover:bg-surface"
              :aria-pressed="condition.values[0] === relativeValue(period)"
              @click="emit('set', '=', [relativeValue(period)])"
            >
              {{ PERIOD_LABELS[period] }}
            </button>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <label class="flex flex-col gap-1 text-[length:var(--text-caption)] text-secondary">
              Desde
              <input
                v-model="from"
                type="date"
                class="data rounded-[var(--radius-control)] border border-separator bg-surface px-2 py-1 text-[length:var(--text-body)] text-content"
                @change="applyRange"
              >
            </label>
            <label class="flex flex-col gap-1 text-[length:var(--text-caption)] text-secondary">
              Hasta
              <input
                v-model="to"
                type="date"
                class="data rounded-[var(--radius-control)] border border-separator bg-surface px-2 py-1 text-[length:var(--text-body)] text-content"
                @change="applyRange"
              >
            </label>
          </div>
        </div>

        <!-- Texto libre. -->
        <form
          v-else
          @submit.prevent="submitText"
        >
          <input
            v-model="textValue"
            type="text"
            :aria-label="meta.label"
            class="w-full rounded-[var(--radius-control)] border border-separator bg-surface px-2 py-1 text-[length:var(--text-body)] text-content"
          >
        </form>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
