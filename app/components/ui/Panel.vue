<script setup lang="ts">
/**
 * Panel del tablero de salidas: el único contenedor con fondo propio. Dentro no
 * van más tarjetas; se ordena con espaciado, columnas y rellenos alternos.
 */
defineProps<{
  /** Etiqueta accesible de la región cuando no hay cabecera visible. */
  label?: string
}>()
</script>

<template>
  <section
    class="overflow-hidden rounded-[var(--radius-surface)] border border-separator bg-raised shadow-panel"
    :aria-label="label"
  >
    <header
      v-if="$slots.header"
      class="flex min-h-12 items-center gap-2 px-4"
    >
      <slot name="header" />
    </header>
    <slot />
  </section>
</template>
