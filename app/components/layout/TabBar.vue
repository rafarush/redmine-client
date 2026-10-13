<script setup lang="ts">
/**
 * Navegación de primer nivel en ancho compacto. Las pestañas solo navegan, nunca
 * ejecutan acciones, y ninguna se oculta ni se deshabilita (HIG tab-bars.md).
 */
const items = useNavItems()
</script>

<template>
  <nav
    class="flex shrink-0 border-t border-separator bg-raised pb-[env(safe-area-inset-bottom)] wide:hidden"
    aria-label="Secciones"
  >
    <NuxtLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="flex min-h-[var(--control-min)] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[length:var(--text-caption)] text-secondary transition-colors aria-[current=page]:font-medium aria-[current=page]:text-accent"
    >
      <Icon
        :name="item.icon"
        class="size-5 shrink-0"
        aria-hidden="true"
      />
      {{ item.short }}
    </NuxtLink>
  </nav>
</template>
