<script setup lang="ts">
import type { ProjectNode } from '../../../shared/redmine/projects'
import { countDescendants, issuesLink, nextVersion } from '../../../shared/redmine/projects'

/**
 * Fila del navegador de proyectos (F6-T01): placa, nombre, tareas abiertas y
 * próxima versión, y el botón de fijar en la sidebar. Se ven dos niveles; a partir
 * del tercero, "Ver subproyectos" los despliega en el sitio.
 */
const props = defineProps<{
  node: ProjectNode
  depth: number
  /** Con búsqueda activa todo va desplegado: interesa ver dónde está lo encontrado. */
  expandAll: boolean
  index: number
}>()

const projectsStore = useProjectsStore()
const project = computed(() => props.node.project)

const count = useIssueCount(() => ({ project_id: project.value.id, status_id: 'open' }))
const versions = useProjectVersions(() => project.value.id)
const next = computed(() => nextVersion(versions.data.value ?? [], today()))

const expanded = ref(false)
const showChildren = computed(() => props.node.children.length > 0 && (props.depth < 1 || expanded.value || props.expandAll))
const hidden = computed(() => countDescendants(props.node))

const pinned = computed(() => projectsStore.isPinned(project.value.id))
const openLink = computed(() => issuesLink([
  { field: 'project_id', operator: '=', values: [String(project.value.id)] },
  { field: 'status_id', operator: '=', values: ['open'] },
]))
const dueFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' })
</script>

<template>
  <li>
    <div
      class="group grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-1 wide:grid-cols-[minmax(0,1fr)_7rem_12rem_auto]"
      :class="index % 2 ? 'bg-fill-alt' : ''"
    >
      <span
        class="flex min-w-0 items-center gap-2"
        :style="{ paddingLeft: `${depth * 1.25}rem` }"
      >
        <Icon
          v-if="depth > 0"
          name="lucide:corner-down-right"
          class="size-3.5 shrink-0 text-tertiary"
          aria-hidden="true"
        />
        <UiPlate :name="project.name" />
        <NuxtLink
          :to="`/projects/${project.identifier}`"
          class="truncate font-medium hover:underline"
        >{{ project.name }}</NuxtLink>
        <span
          v-if="project.status === 5"
          class="inline-flex shrink-0 items-center gap-1 text-[length:var(--text-caption)] text-secondary"
        >
          <Icon
            name="lucide:lock"
            class="size-3"
            aria-hidden="true"
          />
          Cerrado
        </span>
      </span>

      <NuxtLink
        :to="openLink"
        class="data hidden text-right text-secondary hover:text-content hover:underline wide:block"
        :aria-label="count.data.value === undefined ? 'Tareas abiertas' : `${count.data.value} tareas abiertas en ${project.name}`"
      >
        {{ count.data.value ?? '·' }} <span class="font-sans">abiertas</span>
      </NuxtLink>

      <NuxtLink
        v-if="next"
        :to="`/projects/${project.identifier}/versions`"
        class="hidden min-w-0 items-baseline gap-2 text-secondary hover:text-content wide:flex"
        :aria-label="`Próxima versión de ${project.name}: ${next.name}`"
      >
        <Icon
          name="lucide:flag"
          class="size-3.5 shrink-0 self-center"
          aria-hidden="true"
        />
        <span class="truncate">{{ next.name }}</span>
        <span
          v-if="next.due_date"
          class="data shrink-0"
        >{{ dueFormat.format(new Date(`${next.due_date}T00:00:00`)).replace('.', '') }}</span>
      </NuxtLink>
      <span
        v-else
        class="hidden text-tertiary wide:block"
      >Sin versiones</span>

      <UiButton
        :label="pinned ? `Quitar ${project.name} de la sidebar` : `Fijar ${project.name} en la sidebar`"
        :icon="pinned ? 'lucide:pin-off' : 'lucide:pin'"
        icon-only
        variant="ghost"
        :aria-pressed="pinned"
        :class="pinned ? 'text-content' : 'opacity-60 group-hover:opacity-100 focus-visible:opacity-100'"
        @click="projectsStore.toggle(project.id)"
      />
    </div>

    <button
      v-if="node.children.length > 0 && depth >= 1 && !expanded && !expandAll"
      type="button"
      class="flex min-h-9 w-full items-center gap-1 px-4 text-left text-[length:var(--text-caption)] text-secondary hover:text-content"
      :style="{ paddingLeft: `${(depth + 1) * 1.25 + 1}rem` }"
      :aria-label="`Ver subproyectos de ${project.name} (${hidden})`"
      @click="expanded = true"
    >
      <Icon
        name="lucide:chevron-right"
        class="size-3.5"
        aria-hidden="true"
      />
      Ver subproyectos ({{ hidden }})
    </button>

    <ul v-if="showChildren">
      <ProjectsProjectRow
        v-for="(child, i) in node.children"
        :key="child.project.id"
        :node="child"
        :depth="depth + 1"
        :expand-all="expandAll"
        :index="index + i + 1"
      />
    </ul>
  </li>
</template>
