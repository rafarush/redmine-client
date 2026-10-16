<script setup lang="ts">
/**
 * Toolbar único de la vista (F2b): título grande, acciones de la página y búsqueda.
 * Cada página pone su título con `definePageMeta({ title })` y sus acciones con
 * `<Teleport defer to="#toolbar-actions">` (secundarias) o `#toolbar-primary` (la
 * acción Ruby, una por pantalla). La navegación vive en la sidebar o la tab bar.
 */
const ui = useUiStore()
const route = useRoute()
const newIssue = useNewIssue()
const shortcuts = useShortcutsStore()

/** Una página con título que depende de datos (un board) lo pone en `page-title`. */
const pageTitle = useState<string | null>('page-title', () => null)
const title = computed(() => pageTitle.value ?? (typeof route.meta.title === 'string' ? route.meta.title : ''))
</script>

<template>
  <header class="relative flex shrink-0 items-center gap-2 px-3 pb-3 pt-3 wide:gap-3 wide:px-6 wide:pt-5">
    <UiButton
      label="Mostrar u ocultar las secciones"
      icon="lucide:panel-left"
      variant="ghost"
      icon-only
      shortcut="Mod+\"
      class="-ml-1 hidden wide:inline-flex"
      :aria-expanded="!ui.sidebarCollapsed"
      @click="ui.toggleSidebar()"
    />

    <h1 class="min-w-0 truncate text-[length:var(--text-large-title)] font-semibold leading-tight tracking-[-0.02em]">
      {{ title }}
    </h1>

    <div
      id="toolbar-actions"
      class="flex items-center gap-1"
    />

    <div class="flex-1" />

    <!--
      Casi centrado en la ventana: con la sidebar visible el centro de la ventana queda
      7rem a la derecha del centro del toolbar; se compensa solo 3rem para no pasarse.
    -->
    <button
      type="button"
      :class="[
        'inline-flex min-h-[var(--control-min)] items-center gap-2 rounded-[var(--radius-control)] border border-separator bg-raised px-2.5 text-left text-[length:var(--text-body)] text-secondary shadow-panel transition-colors hover:bg-fill-hover wide:absolute wide:left-1/2 wide:w-60 wide:-translate-x-1/2',
        ui.sidebarCollapsed ? '' : 'wide:ml-12',
      ]"
      aria-haspopup="dialog"
      aria-label="Buscar tareas y proyectos"
      @click="ui.paletteOpen = true"
    >
      <Icon
        name="lucide:search"
        class="size-4 shrink-0"
        aria-hidden="true"
      />
      <span class="hidden flex-1 truncate wide:inline">Buscar</span>
      <UiKbd
        keys="Mod+K"
        class="hidden wide:inline-flex"
      />
    </button>

    <LayoutThemeSwitcher />

    <Can permission="add_issues">
      <UiTooltip
        text="Nueva tarea"
        :shortcut="shortcuts.bindings.newIssue"
      >
        <UiButton
          label="Nueva tarea"
          icon="lucide:plus"
          @click="newIssue.open"
        />
      </UiTooltip>
    </Can>

    <div
      id="toolbar-primary"
      class="flex items-center"
    />
  </header>
</template>
