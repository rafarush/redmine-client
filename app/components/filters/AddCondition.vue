<script setup lang="ts">
import type { FilterField } from '../../../shared/redmine/filters'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { FIELD_META } from '../../../shared/redmine/filter-fields'

/** "+ Filtro": ofrece los campos que aún no están en la frase. */
defineProps<{
  fields: FilterField[]
  open: boolean
  /** Nombre de cada campo; hace falta para los personalizados (F2-T10). */
  labels?: (field: FilterField) => string
}>()
const emit = defineEmits<{ 'update:open': [open: boolean], 'pick': [field: FilterField] }>()
</script>

<template>
  <PopoverRoot
    v-if="fields.length > 0"
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <PopoverTrigger
      class="ml-1 inline-flex min-h-[var(--control-min)] shrink-0 items-center gap-1 rounded-[var(--radius-control)] px-2 text-[length:var(--text-body)] text-secondary transition-colors hover:bg-fill-hover hover:text-content data-[state=open]:bg-fill-selected"
      data-filter-add
    >
      <Icon
        name="lucide:plus"
        class="size-3.5"
        aria-hidden="true"
      />
      Filtro
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        align="start"
        :side-offset="6"
        class="ui-pop z-50 w-56 rounded-[var(--radius-surface)] border border-separator bg-raised p-1 shadow-popover"
      >
        <button
          v-for="field in fields"
          :key="field"
          type="button"
          class="flex min-h-[var(--control-min)] w-full items-center rounded-[var(--radius-control)] px-2 text-left text-[length:var(--text-body)] text-content hover:bg-surface"
          @click="emit('pick', field)"
        >
          {{ labels ? labels(field) : FIELD_META[field]?.label }}
        </button>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
