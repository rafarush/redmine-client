<script setup lang="ts">
/**
 * Sección aún no construida. El título vive en el toolbar (definePageMeta); aquí
 * se dice qué habrá, en lenguaje de usuario, en vez de dejar la vista en blanco.
 */
defineProps<{
  icon: string
  description: string
}>()
</script>

<template>
  <div class="grid h-full place-items-center p-6">
    <div class="flex max-w-sm flex-col items-center gap-3 text-center">
      <Icon
        :name="icon"
        class="size-8 text-tertiary"
        aria-hidden="true"
      />
      <p class="text-secondary">
        {{ description }}
      </p>
      <p class="panel-label">
        Próximamente
      </p>
    </div>
  </div>
</template>
