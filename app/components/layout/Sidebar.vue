<script setup lang="ts">
import { activeView, ISSUES_PATH, PRESET_VIEWS, viewLocation } from '../../../shared/redmine/views'

/** Navegación de primer nivel en ancho regular. Dos niveles como máximo (HIG sidebars.md). */
const items = useNavItems()
const route = useRoute()
const ui = useUiStore()
const toasts = useToastStore()
const { queries } = useSavedQueries()

/** Vista predefinida que coincide con la frase de la URL; solo existe en la lista. */
const current = computed(() => route.path === ISSUES_PATH ? activeView(typeof route.query.f === 'string' ? route.query.f : null) : undefined)

/** Un solo nivel de selección: blanco con anillo, como el panel; hover neutro. */
const NAV_ITEM = 'flex min-h-[var(--control-min)] items-center gap-2 rounded-[var(--radius-control)] px-2 text-[length:var(--text-body)] text-secondary transition-colors hover:bg-fill-hover hover:text-content aria-[current=page]:bg-raised aria-[current=page]:font-semibold aria-[current=page]:text-content aria-[current=page]:shadow-panel aria-[current=page]:ring-1 aria-[current=page]:ring-separator'

function deleteSaved(id: string, name: string): void {
  const undo = ui.deleteSavedFilter(id)
  toasts.show(`Filtro "${name}" eliminado`, { label: 'Deshacer', run: undo })
}
</script>

<template>
  <aside
    class="hidden w-56 shrink-0 flex-col gap-1 bg-sidebar px-3 pb-3 pt-4 wide:flex"
    aria-label="Secciones"
  >
    <nav class="flex flex-col gap-0.5">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        :class="NAV_ITEM"
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
      class="mt-5 flex flex-col gap-0.5"
    >
      <h2
        id="views-heading"
        class="panel-label px-2 pb-1"
      >
        Vistas
      </h2>
      <NuxtLink
        v-for="view in PRESET_VIEWS"
        :key="view.id"
        :to="viewLocation(view)"
        :aria-current="current?.id === view.id ? 'page' : undefined"
        :class="NAV_ITEM"
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
      class="mt-5 flex flex-col gap-0.5"
    >
      <h2
        id="saved-heading"
        class="panel-label px-2 pb-1"
      >
        Filtros guardados
      </h2>

      <div
        v-for="saved in ui.savedFilters"
        :key="saved.id"
        class="group flex items-center"
      >
        <NuxtLink
          :to="{ path: ISSUES_PATH, query: { f: saved.f } }"
          :aria-current="route.path === ISSUES_PATH && route.query.f === saved.f ? 'page' : undefined"
          :class="[NAV_ITEM, 'min-w-0 flex-1']"
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
          @click="deleteSaved(saved.id, saved.name)"
        />
      </div>

      <NuxtLink
        v-for="query in queries"
        :key="`redmine-${query.id}`"
        :to="{ path: ISSUES_PATH, query: { q: String(query.id), p: query.project_id ? String(query.project_id) : undefined } }"
        :aria-current="route.path === ISSUES_PATH && route.query.q === String(query.id) ? 'page' : undefined"
        :class="NAV_ITEM"
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

    <div class="mt-auto pt-2">
      <LayoutAccountMenu />
    </div>
  </aside>
</template>
