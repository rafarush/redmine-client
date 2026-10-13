<script setup lang="ts">
/** Navegación de primer nivel en ancho regular. Dos niveles como máximo (HIG sidebars.md). */
const items = useNavItems()
</script>

<template>
  <aside
    class="hidden w-56 shrink-0 flex-col gap-1 border-r border-separator bg-surface p-2 wide:flex"
    aria-label="Secciones"
  >
    <nav class="flex flex-col gap-0.5">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="flex min-h-[var(--control-min)] items-center gap-2 rounded-[var(--radius-control)] px-2 text-[length:var(--text-body)] text-secondary transition-colors hover:bg-raised hover:text-content aria-[current=page]:bg-raised aria-[current=page]:font-medium aria-[current=page]:text-content"
      >
        <Icon
          :name="item.icon"
          class="size-4 shrink-0"
          aria-hidden="true"
        />
        {{ item.label }}
      </NuxtLink>
    </nav>

    <!-- Proyectos fijados: F6-T01. -->
  </aside>
</template>
