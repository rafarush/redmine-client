<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { unseenCount } from '../../../shared/redmine/news'
import { activeView, ISSUES_PATH, PRESET_VIEWS, viewLocation } from '../../../shared/redmine/views'

/** Navegación de primer nivel en ancho regular. Dos niveles como máximo (HIG sidebars.md). */
const items = useNavItems()
const route = useRoute()
const ui = useUiStore()
const toasts = useToastStore()
const { queries } = useSavedQueries()
const session = useSessionStore()
const projectsStore = useProjectsStore()

/** Fijados en el navegador de proyectos (F6-T01), en el orden en que se fijaron. */
const pinnedProjects = computed(() => projectsStore.pinned.flatMap((id) => {
  const project = session.catalogs.projects.find(p => p.id === id && p.status !== 9)
  return project ? [project] : []
}))

/** Vista predefinida que coincide con la frase de la URL; solo existe en la lista. */
const current = computed(() => route.path === ISSUES_PATH ? activeView(typeof route.query.f === 'string' ? route.query.f : null) : undefined)

/** Un solo nivel de selección: blanco con anillo, como el panel; hover neutro. */
const NAV_ITEM = 'flex min-h-[var(--control-min)] items-center gap-2 rounded-[var(--radius-control)] px-2 text-[length:var(--text-body)] text-secondary transition-colors hover:bg-fill-hover hover:text-content aria-[current=page]:bg-raised aria-[current=page]:font-semibold aria-[current=page]:text-content aria-[current=page]:shadow-panel aria-[current=page]:ring-1 aria-[current=page]:ring-separator'

/** Noticias (F7-T04): punto de "Novedades" si hay publicadas desde la última visita. */
const redmine = useRedmine()
const newsStore = useNewsStore()
const canReadNews = computed(() => session.can('view_news'))
const latestNews = useQuery({
  queryKey: ['news', 'latest'],
  queryFn: async () => (await redmine.listNews(undefined, { limit: 10 })).items,
  enabled: canReadNews,
  staleTime: 5 * 60_000,
})
const unseenNews = computed(() => unseenCount(latestNews.data.value ?? [], newsStore.lastSeen))

function isInProject(identifier: string): boolean {
  const base = `/projects/${identifier}`
  return route.path === base || route.path.startsWith(`${base}/`)
}

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
      <NuxtLink
        v-if="canReadNews"
        to="/news"
        :class="NAV_ITEM"
      >
        <Icon
          name="lucide:newspaper"
          class="size-4 shrink-0"
          aria-hidden="true"
        />
        Noticias
        <span
          v-if="unseenNews > 0"
          class="ml-auto inline-flex items-center gap-1 text-[length:var(--text-caption)] font-semibold text-content"
        >
          <span
            class="size-2 rounded-full bg-content"
            aria-hidden="true"
          />
          <span class="sr-only">Novedades: {{ unseenNews }} {{ unseenNews === 1 ? 'noticia nueva' : 'noticias nuevas' }}</span>
          <span aria-hidden="true">{{ unseenNews }}</span>
        </span>
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

    <nav
      v-if="pinnedProjects.length > 0"
      aria-labelledby="pinned-heading"
      class="mt-5 flex flex-col gap-0.5"
    >
      <h2
        id="pinned-heading"
        class="panel-label px-2 pb-1"
      >
        Proyectos
      </h2>
      <NuxtLink
        v-for="project in pinnedProjects"
        :key="project.id"
        :to="`/projects/${project.identifier}`"
        :aria-current="isInProject(project.identifier) ? 'page' : undefined"
        :class="NAV_ITEM"
      >
        <UiPlate :name="project.name" />
        <span class="truncate">{{ project.name }}</span>
      </NuxtLink>
    </nav>

    <div class="mt-auto pt-2">
      <LayoutAccountMenu />
    </div>
  </aside>
</template>
