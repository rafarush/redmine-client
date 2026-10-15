<script setup lang="ts">
import { activeView, PRESET_VIEWS, viewLocation } from '../../../shared/redmine/views'

/** Navegación de primer nivel en ancho regular. Dos niveles como máximo (HIG sidebars.md). */
const items = useNavItems()
const route = useRoute()
const ui = useUiStore()
const { queries } = useSavedQueries()

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

    <nav
      v-if="ui.savedFilters.length > 0 || queries.length > 0"
      aria-labelledby="saved-heading"
      class="mt-3 flex flex-col gap-0.5"
    >
      <h2
        id="saved-heading"
        class="px-2 pb-1 text-[length:var(--text-caption)] font-medium text-secondary"
      >
        Filtros guardados
      </h2>

      <div
        v-for="saved in ui.savedFilters"
        :key="saved.id"
        class="group flex items-center"
      >
        <NuxtLink
          :to="{ path: '/', query: { f: saved.f } }"
          :aria-current="route.path === '/' && route.query.f === saved.f ? 'page' : undefined"
          class="flex min-h-[var(--control-min)] min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-control)] px-2 text-[length:var(--text-body)] text-secondary transition-colors hover:bg-raised hover:text-content aria-[current=page]:bg-raised aria-[current=page]:font-medium aria-[current=page]:text-content"
        >
          <Icon
            name="lucide:bookmark"
            class="size-4 shrink-0"
            aria-hidden="true"
          />
          <span class="truncate">{{ saved.name }}</span>
        </NuxtLink>
        <UiButton
          variant="ghost"
          icon-only
          icon="lucide:trash-2"
          :label="`Eliminar filtro ${saved.name}`"
          class="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
          @click="ui.deleteSavedFilter(saved.id)"
        />
      </div>

      <NuxtLink
        v-for="query in queries"
        :key="`redmine-${query.id}`"
        :to="{ path: '/', query: { q: String(query.id), p: query.project_id ? String(query.project_id) : undefined } }"
        :aria-current="route.path === '/' && route.query.q === String(query.id) ? 'page' : undefined"
        class="flex min-h-[var(--control-min)] items-center gap-2 rounded-[var(--radius-control)] px-2 text-[length:var(--text-body)] text-secondary transition-colors hover:bg-raised hover:text-content aria-[current=page]:bg-raised aria-[current=page]:font-medium aria-[current=page]:text-content"
      >
        <Icon
          name="lucide:list-filter"
          class="size-4 shrink-0"
          aria-hidden="true"
        />
        <span class="truncate">{{ query.name }}</span>
        <span class="sr-only">(consulta de Redmine)</span>
      </NuxtLink>
    </nav>

    <!-- Proyectos fijados: F6-T01. -->

    <div class="mt-auto border-t border-separator pt-1">
      <LayoutAccountMenu />
    </div>
  </aside>
</template>
