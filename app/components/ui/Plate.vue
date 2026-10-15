<script setup lang="ts">
import { projectCode } from '../../../shared/redmine/issue-display'

/**
 * Placa de código de proyecto (PCL, APP): identifica el proyecto como el código
 * de un vuelo en el panel de salidas, sin depender del color. El nombre completo
 * va en `title` y en el texto accesible.
 */
const props = defineProps<{
  /** Identificador o nombre del proyecto; se abrevia a 3 letras si no se da `code`. */
  name: string
  code?: string
}>()

const label = computed(() => props.code ?? projectCode(props.name))
</script>

<template>
  <span
    class="data inline-flex h-4 shrink-0 items-center rounded-[var(--radius-plate)] bg-board px-1 text-[10px] font-semibold uppercase leading-none tracking-[0.04em] text-on-board"
    :title="name"
  >
    <span aria-hidden="true">{{ label }}</span>
    <span class="sr-only">{{ name }}</span>
  </span>
</template>
