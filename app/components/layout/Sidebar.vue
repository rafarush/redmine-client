<script setup lang="ts">
import { activeView, PRESET_VIEWS, viewLocation } from '../../../shared/redmine/views'

/** Navegación de primer nivel en ancho regular. Dos niveles como máximo (HIG sidebars.md). */
const items = useNavItems()
const route = useRoute()

/** Vista predefinida que coincide con la frase de la URL; solo existe en la lista. */
const current = computed(() => route.path === '/' ? activeView(typeof route.query.f === 'string' ? route.query.f : null) : undefined)
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

    <nav
      aria-labelledby="views-heading"
      class="mt-3 flex flex-col gap-0.5"
    >
      <h2
        id="views-heading"
        class="px-2 pb-1 text-[length:var(--text-caption)] font-medium text-secondary"
      >
        Vistas
      </h2>
      <NuxtLink
        v-for="view in PRESET_VIEWS"
        :key="view.id"
        :to="viewLocation(view)"
        :aria-current="current?.id === view.id ? 'page' : undefined"
        class="flex min-h-[var(--control-min)] items-center gap-2 rounded-[var(--radius-control)] px-2 text-[length:var(--text-body)] text-secondary transition-colors hover:bg-raised hover:text-content aria-[current=page]:bg-raised aria-[current=page]:font-medium aria-[current=page]:text-content"
      >
        <Icon
          :name="view.icon"
          class="size-4 shrink-0"
          aria-hidden="true"
        />
        {{ view.label }}
      </NuxtLink>
    </nav>

    <!-- Proyectos fijados: F6-T01. -->

    <div class="mt-auto border-t border-separator pt-1">
      <LayoutAccountMenu />
    </div>
  </aside>
</template>
