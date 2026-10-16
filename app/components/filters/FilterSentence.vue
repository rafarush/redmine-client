<script setup lang="ts">
import type { FilterCondition, FilterField, FilterSentence } from '../../../shared/redmine/filters'
import type { CustomFieldDef, FieldMeta, FilterOption } from '../../../shared/redmine/filter-fields'
import { availableFields, emptyCondition, fieldMeta, removeLast, setValues, toggleValue } from '../../../shared/redmine/filter-fields'
import { conditionFor, describe, describeConditionParts, withoutField } from '../../../shared/redmine/filters'

/**
 * La frase de filtros (F2-T04): "Tareas asignadas a mí, en abierta…".
 * Es un grupo con su descripción completa para lectores de pantalla; cada token
 * es un botón. Solo un popover abierto a la vez.
 */
const props = defineProps<{
  modelValue: FilterSentence
  /**
   * Personas que ofrecer en "Asignado a" y "Autor": miembros de los proyectos y las
   * vistas en la lista (Redmine no deja listar usuarios a quien no es admin).
   */
  people?: FilterOption[]
  /** Campos personalizados filtrables (F2-T10). */
  customFields?: CustomFieldDef[]
  /** Categorías de tareas de los proyectos de la frase. */
  categories?: FilterOption[]
}>()
const emit = defineEmits<{ 'update:modelValue': [sentence: FilterSentence] }>()

const customFields = computed(() => props.customFields ?? [])
const options = useFilterOptions(() => props.people ?? [], customFields, () => props.categories ?? [])
/** Un `cf_` de un enlace viejo que ya no se conoce se edita como texto. */
const metaOf = (field: FilterField): FieldMeta => fieldMeta(field, customFields.value) ?? { label: 'Campo personalizado', kind: 'text' }
const lookup = (field: FilterField, value: string) => {
  // Sin valor, la frase pide cómo nombrar el campo personalizado: "con Cliente".
  if (value === '' && field.startsWith('cf_')) return `con ${metaOf(field).label}`
  return options(field).find(o => o.value === value)?.label
}
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

const addable = computed(() => availableFields({ conditions: conditions.value }, customFields.value))

/** Entre elegir el campo y abrir su editor no se descarta la condición pendiente. */
let opening = false

watch(openField, (field) => {
  if (opening) return
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
  pending.value = emptyCondition(field, customFields.value)
  // Se cierra el selector y, ya con el foco asentado, se abre el editor del token nuevo;
  // si se abre a la vez, el cambio de foco lo descarta al instante.
  opening = true
  openField.value = null
  setTimeout(() => {
    opening = false
    if (pending.value?.field === field) openField.value = field
  }, 50)
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
  <div class="flex flex-col gap-1 px-3 pb-2 wide:px-6">
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
      class="flex items-center gap-x-1 gap-y-0.5 overflow-x-auto wide:flex-wrap"
      @keydown="onKeydown"
    >
      <span
        v-if="conditions.length === 0"
        class="shrink-0 text-[length:var(--text-body)] text-secondary"
      >
        Todas las tareas
      </span>

      <span
        v-else
        class="shrink-0 text-[length:var(--text-body)] text-secondary"
        aria-hidden="true"
      >Tareas</span>

      <template
        v-for="(condition, index) in conditions"
        :key="condition.field"
      >
        <FiltersFilterToken
          :condition="condition"
          :meta="metaOf(condition.field)"
          :lead="describeConditionParts(condition, lookup).lead"
          :text="describeConditionParts(condition, lookup).value"
          :options="options(condition.field)"
          :open="openField === condition.field"
          @update:open="setOpen(condition.field, $event)"
          @toggle="update(toggleValue(modelValue, condition.field, $event))"
          @set="(operator, values) => update(setValues(modelValue, condition.field, operator, values))"
          @remove="remove(condition.field)"
        />
        <span
          v-if="index < conditions.length - 1"
          class="-ml-1 shrink-0 text-secondary"
          aria-hidden="true"
        >,</span>
      </template>

      <FiltersAddCondition
        :fields="addable"
        :labels="(field: FilterField) => metaOf(field).label"
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
