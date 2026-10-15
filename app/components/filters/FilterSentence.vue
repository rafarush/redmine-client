<script setup lang="ts">
import type { FilterCondition, FilterField, FilterSentence } from '../../../shared/redmine/filters'
import type { FilterOption } from '../../../shared/redmine/filter-fields'
import { availableFields, emptyCondition, FIELD_META, removeLast, setValues, toggleValue } from '../../../shared/redmine/filter-fields'
import { conditionFor, describe, describeCondition, withoutField } from '../../../shared/redmine/filters'

/**
 * La frase de filtros (F2-T04): "Tareas asignadas a mí, en abierta…".
 * Es un grupo con su descripción completa para lectores de pantalla; cada token
 * es un botón. Solo un popover abierto a la vez.
 */
const props = defineProps<{
  modelValue: FilterSentence
  /** Personas vistas en la lista actual (Redmine no deja listar usuarios a quien no es admin). */
  people?: FilterOption[]
}>()
const emit = defineEmits<{ 'update:modelValue': [sentence: FilterSentence] }>()

const options = useFilterOptions(() => props.people ?? [])
const lookup = (field: FilterField, value: string) => options(field).find(o => o.value === value)?.label
const summary = computed(() => describe(props.modelValue, lookup))

/** Campo cuyo popover está abierto; `'add'` es el selector de "+ Filtro". */
const openField = ref<FilterField | 'add' | null>(null)
const root = ref<HTMLElement | null>(null)

/** Condición recién elegida que aún no tiene valores, así que todavía no está en la frase. */
const pending = ref<FilterCondition | null>(null)

const conditions = computed(() => {
  const list = [...props.modelValue.conditions]
  if (pending.value && !conditionFor(props.modelValue, pending.value.field)) list.push(pending.value)
  return list
})

const addable = computed(() => availableFields({ conditions: conditions.value }))

watch(openField, (field) => {
  if (pending.value && field !== pending.value.field) pending.value = null
})

function update(sentence: FilterSentence): void {
  emit('update:modelValue', sentence)
}

function setOpen(key: FilterField | 'add', open: boolean): void {
  if (open) openField.value = key
  else if (openField.value === key) openField.value = null
}

function pick(field: FilterField): void {
  pending.value = emptyCondition(field)
  openField.value = field
}

function focusFirst(): void {
  root.value?.querySelector<HTMLElement>('[data-filter-token], [data-filter-add]')?.focus()
}

function remove(field: FilterField): void {
  if (pending.value?.field === field) pending.value = null
  openField.value = null
  update(withoutField(props.modelValue, field))
  nextTick(focusFirst)
}

function onKeydown(event: KeyboardEvent): void {
  // Retroceso con el foco en el grupo (no dentro de un campo) quita el último token.
  if (event.key === 'Backspace' && event.target === root.value) update(removeLast(props.modelValue))
}

// Atajo `/`: enfoca la frase salvo que se esté escribiendo en otro sitio.
function onWindowKeydown(event: KeyboardEvent): void {
  if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
  const target = event.target as HTMLElement | null
  if (target && (target.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
  event.preventDefault()
  expanded.value = true
  nextTick(focusFirst)
}

// En compacto la frase se pliega en "N filtros" y, desplegada, se desplaza en horizontal.
const compact = ref(false)
const expanded = ref(false)
let media: MediaQueryList | undefined
function syncMedia(): void {
  compact.value = !!media?.matches
}

onMounted(() => {
  window.addEventListener('keydown', onWindowKeydown)
  media = window.matchMedia('(max-width: 899px)')
  syncMedia()
  media.addEventListener('change', syncMedia)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown)
  media?.removeEventListener('change', syncMedia)
})

const count = computed(() => props.modelValue.conditions.length)
const countLabel = computed(() => count.value === 0 ? 'Sin filtros' : count.value === 1 ? '1 filtro' : `${count.value} filtros`)
const showRow = computed(() => !compact.value || expanded.value)
</script>

<template>
  <div class="flex flex-col gap-1 border-b border-separator bg-surface px-2 py-1.5">
    <button
      v-if="compact"
      type="button"
      class="inline-flex min-h-[var(--control-min)] items-center gap-1 self-start text-[length:var(--text-body)] text-content"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      {{ countLabel }}
      <Icon
        :name="expanded ? 'lucide:chevron-up' : 'lucide:chevron-down'"
        class="size-4"
        aria-hidden="true"
      />
    </button>

    <div
      v-show="showRow"
      ref="root"
      role="group"
      tabindex="-1"
      :aria-label="summary"
      class="flex items-center gap-1.5 overflow-x-auto wide:flex-wrap"
      @keydown="onKeydown"
    >
      <span
        v-if="conditions.length === 0"
        class="shrink-0 text-[length:var(--text-body)] text-secondary"
      >
        Todas las tareas
      </span>

      <FiltersFilterToken
        v-for="condition in conditions"
        :key="condition.field"
        :condition="condition"
        :meta="FIELD_META[condition.field]!"
        :text="describeCondition(condition, lookup)"
        :options="options(condition.field)"
        :open="openField === condition.field"
        @update:open="setOpen(condition.field, $event)"
        @toggle="update(toggleValue(modelValue, condition.field, $event))"
        @set="(operator, values) => update(setValues(modelValue, condition.field, operator, values))"
        @remove="remove(condition.field)"
      />

      <FiltersAddCondition
        :fields="addable"
        :open="openField === 'add'"
        @update:open="setOpen('add', $event)"
        @pick="pick"
      />

      <div class="ml-auto shrink-0">
        <slot name="trailing" />
      </div>
    </div>
  </div>
</template>
