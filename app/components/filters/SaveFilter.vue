<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { cleanName } from '../../../shared/redmine/saved-filters'

/** "Guardar filtro": pide un nombre y guarda la frase actual en local. */
defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ save: [name: string] }>()

const open = ref(false)
const name = ref('')
const valid = computed(() => cleanName(name.value).length > 0)

watch(open, (isOpen) => {
  if (isOpen) name.value = ''
})

function submit(): void {
  if (!valid.value) return
  emit('save', name.value)
  open.value = false
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger
      :disabled="disabled"
      class="inline-flex min-h-[var(--control-min)] shrink-0 items-center gap-1 rounded-[var(--radius-control)] px-2 text-[length:var(--text-body)] text-secondary transition-colors hover:bg-fill-hover hover:text-content disabled:cursor-not-allowed disabled:opacity-50"
      data-filter-save
    >
      <Icon
        name="lucide:bookmark-plus"
        class="size-3.5"
        aria-hidden="true"
      />
      Guardar filtro
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        align="end"
        :side-offset="6"
        class="ui-pop z-50 w-64 rounded-[var(--radius-surface)] border border-separator bg-raised p-3 shadow-popover"
      >
        <form
          class="flex flex-col gap-2"
          @submit.prevent="submit"
        >
          <label
            for="saved-filter-name"
            class="text-[length:var(--text-body)] font-medium text-content"
          >
            Nombre del filtro
          </label>
          <input
            id="saved-filter-name"
            v-model="name"
            type="text"
            maxlength="60"
            autocomplete="off"
            placeholder="Urgentes de esta semana"
            class="min-h-[var(--control-min)] rounded-[var(--radius-control)] border border-separator bg-surface px-2 text-[length:var(--text-body)] text-content placeholder:text-secondary"
          >
          <UiButton
            type="submit"
            variant="primary"
            label="Guardar filtro"
            :disabled="!valid"
          />
        </form>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
