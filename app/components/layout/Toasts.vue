<script setup lang="ts">
const toasts = useToastStore()
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 top-14 z-50 flex flex-col items-center gap-2 px-4"
  >
    <!-- aria-live aquí, no en cada toast: así el anuncio llega aunque el aviso aparezca ya montado. -->
    <div
      role="status"
      aria-live="polite"
      class="flex flex-col items-center gap-2"
    >
      <div
        v-for="toast in toasts.items"
        :key="toast.id"
        class="pointer-events-auto flex min-h-[var(--control-min)] items-center gap-3 rounded-[var(--radius-surface)] border border-separator bg-raised px-3 py-2 text-[length:var(--text-body)] text-content shadow-lg motion-safe:transition-opacity"
      >
        <span>{{ toast.message }}</span>
        <UiButton
          v-if="toast.action"
          variant="ghost"
          :label="toast.action.label"
          @click="toast.action.run(); toasts.dismiss(toast.id)"
        />
      </div>
    </div>
  </div>
</template>
