<script setup lang="ts">
/** Acciones sobre la vista actual. La navegación vive en la sidebar o la tab bar. */
const ui = useUiStore()
</script>

<template>
  <header class="flex shrink-0 items-center gap-2 border-b border-separator bg-surface px-2 py-1.5">
    <UiButton
      label="Mostrar u ocultar las secciones"
      icon="lucide:panel-left"
      variant="ghost"
      icon-only
      shortcut="Mod+\"
      class="hidden wide:inline-flex"
      :aria-expanded="!ui.sidebarCollapsed"
      @click="ui.toggleSidebar()"
    />

    <button
      type="button"
      class="inline-flex min-h-[var(--control-min)] max-w-72 flex-1 items-center gap-2 rounded-[var(--radius-control)] border border-separator bg-raised px-3 text-left text-[length:var(--text-body)] text-secondary hover:border-secondary"
      aria-haspopup="dialog"
      @click="ui.paletteOpen = true"
    >
      <Icon
        name="lucide:search"
        class="size-4 shrink-0"
        aria-hidden="true"
      />
      <span class="flex-1 truncate">Buscar</span>
      <UiKbd
        keys="Mod+K"
        class="hidden wide:inline-flex"
      />
    </button>

    <div class="flex-1 wide:flex-none" />

    <!-- Nueva tarea: F3-T07. Solo donde el usuario puede crearlas. -->
    <Can permission="add_issues">
      <UiButton
        label="Nueva tarea"
        icon="lucide:plus"
        variant="primary"
        disabled
      />
    </Can>
  </header>
</template>
