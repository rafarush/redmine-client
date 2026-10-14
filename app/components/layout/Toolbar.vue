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

    <!-- Búsqueda global: F2-T07. Hasta entonces, el botón anuncia el atajo sin prometer función. -->
    <UiButton
      label="Buscar"
      icon="lucide:search"
      variant="secondary"
      class="max-w-72 flex-1 justify-start text-secondary"
      disabled
    />

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
