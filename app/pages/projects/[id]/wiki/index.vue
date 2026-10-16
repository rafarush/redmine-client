<script setup lang="ts">
import { buildWikiTree, filterWikiTree, startPage, wikiLabel } from '../../../../../shared/redmine/wiki'

/**
 * Índice de la wiki de un proyecto (F7-T01): la página de inicio destacada, el
 * árbol de páginas por `parent` y búsqueda por título. Solo con módulo `wiki` y
 * `view_wiki_pages`.
 */
definePageMeta({ title: 'Wiki' })

const route = useRoute()
const session = useSessionStore()
const project = useProjectRef(() => String(route.params.id))
const allowed = computed(() => !!project.value && session.can('view_wiki_pages', project.value.id))
const index = useWikiIndex(() => allowed.value ? project.value?.identifier : undefined)

const pageTitle = useState<string | null>('page-title')
watchEffect(() => {
  pageTitle.value = project.value ? `Wiki · ${project.value.name}` : null
})
onBeforeUnmount(() => {
  pageTitle.value = null
})

const search = ref('')
const pages = computed(() => index.data.value ?? [])
const tree = computed(() => filterWikiTree(buildWikiTree(pages.value), search.value))
const start = computed(() => startPage(pages.value))
const canEdit = computed(() => !!project.value && session.can('edit_wiki_pages', project.value.id))
const recent = computed(() => [...pages.value]
  .filter(p => p.updated_on)
  .sort((a, b) => b.updated_on!.localeCompare(a.updated_on!))
  .slice(0, 5))

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' })

const newTitle = ref('')
function createPage(): void {
  const title = newTitle.value.trim()
  if (!title || !project.value) return
  void navigateTo(`/projects/${project.value.identifier}/wiki/${encodeURIComponent(title)}?edit=1`)
}
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 px-3 pb-6 wide:px-6">
    <p
      v-if="!project || !allowed"
      role="alert"
      class="py-16 text-center text-secondary"
    >
      {{ project ? 'Este proyecto no tiene la wiki activada o no tienes permiso para leerla.' : `No encuentro el proyecto "${route.params.id}".` }}
    </p>

    <template v-else>
      <NuxtLink
        v-if="start"
        :to="`/projects/${project.identifier}/wiki/${encodeURIComponent(start)}`"
        class="flex items-center gap-3 rounded-[var(--radius-surface)] bg-board px-4 py-3 text-on-board shadow-popover hover:brightness-110"
      >
        <Icon
          name="lucide:house"
          class="size-5"
          aria-hidden="true"
        />
        <span class="flex flex-col">
          <span class="panel-label !text-on-board-secondary">Página de inicio</span>
          <span class="text-[length:var(--text-title)] font-semibold">{{ wikiLabel(start) }}</span>
        </span>
      </NuxtLink>

      <div class="grid items-start gap-4 wide:grid-cols-[minmax(0,1fr)_18rem]">
        <UiPanel label="Páginas">
          <template #header>
            <label class="flex min-w-0 flex-1 items-center gap-2">
              <Icon
                name="lucide:search"
                class="size-4 shrink-0 text-secondary"
                aria-hidden="true"
              />
              <span class="sr-only">Buscar página por título</span>
              <input
                v-model="search"
                type="search"
                placeholder="Buscar página…"
                class="min-h-[var(--control-min)] min-w-0 flex-1 bg-transparent outline-none"
              >
            </label>
            <span class="data text-[length:var(--text-caption)] text-secondary">{{ pages.length }} páginas</span>
          </template>

          <div
            v-if="index.isPending.value"
            class="flex flex-col gap-2 px-4 pb-4"
            aria-busy="true"
            aria-label="Cargando el índice"
          >
            <div
              v-for="n in 5"
              :key="n"
              class="h-8 rounded-[var(--radius-control)] bg-fill-selected motion-safe:animate-pulse"
            />
          </div>
          <div
            v-else-if="index.error.value"
            role="alert"
            class="flex flex-col items-center gap-3 px-4 py-8 text-center"
          >
            <p class="text-secondary">
              No se pudo leer el índice de la wiki.
            </p>
            <UiButton
              label="Reintentar"
              icon="lucide:rotate-cw"
              @click="index.refetch()"
            />
          </div>
          <ul
            v-else-if="tree.length > 0"
            class="flex flex-col border-t border-separator p-2"
          >
            <WikiTreeNode
              v-for="node in tree"
              :key="node.page.title"
              :node="node"
              :project="project.identifier"
              :depth="0"
            />
          </ul>
          <p
            v-else
            class="border-t border-separator px-4 py-6 text-secondary"
          >
            {{ search.trim() ? `Ninguna página se llama "${search.trim()}".` : 'Esta wiki aún no tiene páginas.' }}
          </p>
        </UiPanel>

        <div class="flex flex-col gap-4">
          <UiPanel
            v-if="canEdit"
            label="Nueva página"
          >
            <template #header>
              <h2 class="panel-label !text-content">
                Nueva página
              </h2>
            </template>
            <form
              class="flex gap-2 px-4 pb-4"
              @submit.prevent="createPage"
            >
              <input
                v-model="newTitle"
                type="text"
                placeholder="Título"
                aria-label="Título de la página nueva"
                class="min-h-[var(--control-min)] min-w-0 flex-1 rounded-[var(--radius-control)] border border-separator bg-surface px-2.5"
              >
              <UiButton
                type="submit"
                label="Crear"
                icon="lucide:plus"
                :disabled="!newTitle.trim()"
              />
            </form>
          </UiPanel>

          <UiPanel
            v-if="recent.length > 0"
            label="Cambios recientes"
          >
            <template #header>
              <h2 class="panel-label !text-content">
                Cambios recientes
              </h2>
            </template>
            <ul class="flex flex-col pb-2">
              <li
                v-for="page in recent"
                :key="page.title"
              >
                <NuxtLink
                  :to="`/projects/${project.identifier}/wiki/${encodeURIComponent(page.title)}`"
                  class="flex min-h-9 items-baseline gap-2 px-4 hover:bg-fill-hover"
                >
                  <span class="min-w-0 flex-1 truncate">{{ wikiLabel(page.title) }}</span>
                  <span class="data shrink-0 text-[length:var(--text-caption)] text-secondary">{{ dateFormat.format(new Date(page.updated_on!)).replace('.', '') }}</span>
                </NuxtLink>
              </li>
            </ul>
          </UiPanel>
        </div>
      </div>
    </template>
  </div>
</template>
