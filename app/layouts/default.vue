<script setup lang="ts">
const ui = useUiStore()

/** `Mod+\` muestra u oculta las secciones. Solo tiene sentido con sidebar. */
function alAtajo(evento: KeyboardEvent): void {
  if (evento.key === '\\' && (evento.ctrlKey || evento.metaKey)) {
    evento.preventDefault()
    ui.alternarSidebar()
  }
}

onMounted(() => {
  ui.restaurar()
  window.addEventListener('keydown', alAtajo)
})

onUnmounted(() => window.removeEventListener('keydown', alAtajo))
</script>

<template>
  <div class="flex h-dvh flex-col bg-surface text-content">
    <a
      href="#contenido"
      class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-[var(--radius-control)] focus:bg-raised focus:px-3 focus:py-2"
    >
      Saltar al contenido
    </a>

    <div class="flex min-h-0 flex-1">
      <LayoutSidebar v-show="!ui.sidebarColapsada" />

      <div class="flex min-w-0 flex-1 flex-col">
        <LayoutToolbar />
        <main
          id="contenido"
          class="min-h-0 flex-1 overflow-auto"
        >
          <slot />
        </main>
      </div>
    </div>

    <LayoutTabBar />
  </div>
</template>
