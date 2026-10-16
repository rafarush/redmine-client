<script setup lang="ts">
const ui = useUiStore()
/** Ajustes del workspace: los abre el workspace o el aviso de "elige el estado" desde cualquier vista. */
const settingsOpen = useState('workspace-settings-open', () => false)

/**
 * `Mod+\` muestra u oculta las secciones y `Mod+K` abre la búsqueda global; son fijos.
 * Los demás atajos son personalizables (`useShortcut`, ajustes del workspace).
 */
function onShortcut(event: KeyboardEvent): void {
  if (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey) && !event.altKey) {
    event.preventDefault()
    ui.paletteOpen = !ui.paletteOpen
    return
  }
  const target = event.target as HTMLElement | null
  const typing = !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  if (event.key === '?' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault()
    ui.shortcutsOpen = !ui.shortcutsOpen
    return
  }
  if (event.key === '\\' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    ui.toggleSidebar()
    return
  }
  runShortcut(event)
}

// Nueva tarea vale en toda la app; Ctrl+B y Ctrl+L los registra el workspace.
const newIssue = useNewIssue()
useShortcut('newIssue', newIssue.open)

onMounted(() => {
  ui.restore()
  window.addEventListener('keydown', onShortcut)
})

onUnmounted(() => window.removeEventListener('keydown', onShortcut))
</script>

<template>
  <div class="flex h-dvh flex-col bg-surface text-content">
    <a
      href="#content"
      class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-[var(--radius-control)] focus:bg-raised focus:px-3 focus:py-2"
    >
      Saltar al contenido
    </a>

    <div class="flex min-h-0 flex-1">
      <LayoutSidebar v-show="!ui.sidebarCollapsed" />

      <div class="flex min-w-0 flex-1 flex-col">
        <LayoutToolbar />
        <main
          id="content"
          class="min-h-0 flex-1 overflow-auto"
        >
          <slot />
        </main>
      </div>
    </div>

    <LayoutTabBar />
    <LayoutCommandPalette />
    <LayoutShortcutsSheet />
    <LayoutToasts />
    <!-- Una sola instancia para toda la app: menú de tarea y diálogos de tiempo y ajustes. -->
    <IssuesIssueContextMenu />
    <WorkspaceTimeAdjustDialog />
    <WorkspaceSettingsDialog v-model:open="settingsOpen" />
  </div>
</template>
