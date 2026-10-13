<script setup lang="ts">
/** Sección aún no construida. Dice qué falta y en qué fase, en vez de dejar la vista en blanco. */
defineProps<{
  title: string
  /** Fase del plan que la construye, p. ej. `F4`. */
  phase: string
  description: string
}>()
</script>

<template>
  <div class="grid h-full place-items-center p-6">
    <div class="max-w-sm text-center">
      <h1 class="text-[length:var(--text-large-title)] font-semibold">
        {{ title }}
      </h1>
      <p class="mt-2 text-secondary">
        {{ description }}
      </p>
      <p class="mt-4 text-[length:var(--text-caption)] text-secondary">
        Se construye en la fase <span class="data">{{ phase }}</span> del plan.
      </p>
    </div>
  </div>
</template>
