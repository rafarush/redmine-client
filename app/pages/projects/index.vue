<script setup lang="ts">
import { buildProjectTree, filterProjectTree } from '../../../shared/redmine/projects'

/**
 * Navegador de proyectos (F6-T01): árbol de proyectos y subproyectos, búsqueda
 * por nombre y fijar en la sidebar. Los archivados no salen.
 */
definePageMeta({ title: 'Proyectos' })

const session = useSessionStore()
const search = ref('')

const tree = computed(() => buildProjectTree(session.catalogs.projects))
const shown = computed(() => filterProjectTree(tree.value, search.value))
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 px-3 pb-6 wide:px-6">
    <UiPanel label="Proyectos">
      <template #header>
        <label class="flex min-w-0 flex-1 items-center gap-2">
          <Icon
            name="lucide:search"
            class="size-4 shrink-0 text-secondary"
            aria-hidden="true"
          />
          <span class="sr-only">Buscar proyecto por nombre</span>
          <input
            v-model="search"
            type="search"
            placeholder="Buscar proyecto…"
            class="min-h-[var(--control-min)] min-w-0 flex-1 bg-transparent outline-none"
          >
        </label>
        <span
          class="data text-[length:var(--text-caption)] text-secondary"
          aria-live="polite"
        >{{ session.catalogs.projects.filter(p => p.status !== 9).length }} proyectos</span>
      </template>

      <ul
        v-if="shown.length > 0"
        class="flex flex-col border-t border-separator"
      >
        <ProjectsProjectRow
          v-for="(node, i) in shown"
          :key="node.project.id"
          :node="node"
          :depth="0"
          :expand-all="search.trim() !== ''"
          :index="i"
        />
      </ul>
      <p
        v-else
        class="border-t border-separator px-4 py-8 text-center text-secondary"
      >
        {{ search.trim() ? `Ningún proyecto se llama "${search.trim()}".` : 'No eres miembro de ningún proyecto todavía.' }}
      </p>
    </UiPanel>
  </div>
</template>
