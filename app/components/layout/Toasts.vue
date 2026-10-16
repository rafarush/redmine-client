<script setup lang="ts">
const toasts = useToastStore()
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 top-14 z-50 flex flex-col items-center gap-2 px-4"
    data-toasts
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
        class="ui-pop pointer-events-auto flex min-h-[var(--control-min)] items-center gap-3 rounded-[var(--radius-control)] bg-board py-1.5 pl-3 pr-1.5 text-[length:var(--text-body)] font-medium text-on-board shadow-popover"
        data-state="open"
      >
        <span>{{ toast.message }}</span>
        <button
          v-if="toast.action"
          type="button"
          class="min-h-[var(--control-min)] rounded-[var(--radius-control)] px-2 font-semibold text-on-board underline decoration-on-board-secondary underline-offset-4 hover:bg-board-separator"
          @click="toast.action.run(); toasts.dismiss(toast.id)"
        >
          {{ toast.action.label }}
        </button>
      </div>
    </div>
  </div>
</template>
