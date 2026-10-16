<script setup lang="ts">
import type { FilterCondition } from '../../../../shared/redmine/filters'
import { describeDaysLeft, issuesLink, nextVersion } from '../../../../shared/redmine/projects'
import { formatHours } from '../../../../shared/time/duration'

/**
 * Página de proyecto (F6-T02): nombre, descripción, accesos a los módulos que
 * están habilitados y que el usuario puede ver, tareas por tracker (abiertas y
 * cerradas) y horas del mes. Cada número es un enlace a la lista ya filtrada.
 *
 * La descripción usa el mismo render saneado que las tareas (F3-T03).
 */
definePageMeta({ title: 'Proyecto' })

const route = useRoute()
const session = useSessionStore()
const projectsStore = useProjectsStore()

const project = useProjectRef(() => String(route.params.id))
const id = computed(() => project.value?.id)
const detail = useProjectDetail(id)
const versions = useProjectVersions(id)
const next = computed(() => nextVersion(versions.data.value ?? [], today()))

const pageTitle = useState<string | null>('page-title')
watchEffect(() => {
  pageTitle.value = project.value?.name ?? null
})
onBeforeUnmount(() => {
  pageTitle.value = null
})

const description = computed(() => (detail.data.value?.description ?? project.value?.description ?? '').trim())
const trackers = computed(() => detail.data.value?.trackers ?? project.value?.trackers ?? [])
const parent = computed(() => {
  const parentId = project.value?.parent?.id
  return parentId ? session.catalogs.projects.find(p => p.id === parentId) : undefined
})

/** Base de los enlaces: este proyecto (con sus subproyectos, como en Redmine). */
const inProject = computed<FilterCondition[]>(() => id.value ? [{ field: 'project_id', operator: '=', values: [String(id.value)] }] : [])
const status = (value: 'open' | 'closed' | '*'): FilterCondition => ({ field: 'status_id', operator: value === '*' ? '*' : '=', values: value === '*' ? [] : [value] })

/** Accesos a los módulos: solo los habilitados y permitidos. */
const shortcuts = computed(() => {
  const p = project.value
  if (!p) return []
  const redmine = session.url.replace(/\/$/, '')
  return [
    { label: 'Tareas', icon: 'lucide:ticket', permission: 'view_issues', to: issuesLink([...inProject.value, status('open')]) },
    { label: 'Roadmap', icon: 'lucide:flag', permission: 'view_issues', to: `/projects/${p.identifier}/versions` },
    { label: 'Miembros', icon: 'lucide:users-round', permission: 'view_issues', to: `/projects/${p.identifier}/members` },
    { label: 'Tiempo', icon: 'lucide:timer', permission: 'view_time_entries', href: `${redmine}/projects/${p.identifier}/time_entries` },
    { label: 'Wiki', icon: 'lucide:book-open', permission: 'view_wiki_pages', href: `${redmine}/projects/${p.identifier}/wiki` },
    { label: 'Noticias', icon: 'lucide:newspaper', permission: 'view_news', href: `${redmine}/projects/${p.identifier}/news` },
    { label: 'Archivos', icon: 'lucide:folder-down', permission: 'view_files', href: `${redmine}/projects/${p.identifier}/files` },
  ].filter(s => session.can(s.permission, p.id))
})

// ------------------------------------------------------------ resumen

const canSeeTime = computed(() => !!id.value && session.can('view_time_entries', id.value))
const monthStart = computed(() => `${today().slice(0, 8)}01`)
const hours = useProjectHours(id, monthStart, () => today(), canSeeTime)

const totalOpen = useIssueCount(() => id.value ? { project_id: id.value, status_id: 'open' } : undefined)
const totalClosed = useIssueCount(() => id.value ? { project_id: id.value, status_id: 'closed' } : undefined)

const monthName = new Intl.DateTimeFormat('es', { month: 'long' }).format(new Date())
const dueFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long' })
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 px-3 pb-6 wide:px-6">
    <Teleport
      defer
      to="#toolbar-actions"
    >
      <UiButton
        v-if="project"
        :label="projectsStore.isPinned(project.id) ? 'Quitar de la sidebar' : 'Fijar en la sidebar'"
        :icon="projectsStore.isPinned(project.id) ? 'lucide:pin-off' : 'lucide:pin'"
        icon-only
        variant="ghost"
        :aria-pressed="projectsStore.isPinned(project.id)"
        @click="projectsStore.toggle(project.id)"
      />
      <UiButton
        v-if="project"
        label="Abrir en Redmine"
        icon="lucide:external-link"
        icon-only
        variant="ghost"
        :to="`${session.url.replace(/\/$/, '')}/projects/${project.identifier}`"
        target="_blank"
        rel="noopener"
      />
    </Teleport>

    <div
      v-if="!project"
      role="alert"
      class="flex flex-col items-center gap-3 py-16 text-center"
    >
      <Icon
        name="lucide:folder-x"
        class="size-8 text-tertiary"
        aria-hidden="true"
      />
      <p class="text-secondary">
        No encuentro el proyecto "{{ route.params.id }}". Puede que esté archivado o que no tengas acceso.
      </p>
      <UiButton
        label="Ver proyectos"
        icon="lucide:folder-kanban"
        to="/projects"
      />
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--text-caption)] text-secondary">
        <UiPlate :name="project.name" />
        <span class="data">{{ project.identifier }}</span>
        <template v-if="parent">
          <span aria-hidden="true">·</span>
          <span>Subproyecto de <NuxtLink
            :to="`/projects/${parent.identifier}`"
            class="text-content hover:underline"
          >{{ parent.name }}</NuxtLink></span>
        </template>
        <span
          v-if="project.status === 5"
          class="inline-flex items-center gap-1"
        >
          <Icon
            name="lucide:lock"
            class="size-3"
            aria-hidden="true"
          />
          Cerrado: solo lectura
        </span>
      </div>

      <nav
        v-if="shortcuts.length > 0"
        aria-label="Módulos del proyecto"
        class="flex flex-wrap gap-2"
      >
        <template
          v-for="shortcut in shortcuts"
          :key="shortcut.label"
        >
          <NuxtLink
            v-if="shortcut.to"
            :to="shortcut.to"
            class="inline-flex min-h-[var(--control-min)] items-center gap-1.5 rounded-[var(--radius-control)] border border-separator bg-raised px-3 font-medium shadow-panel hover:bg-fill-hover"
          >
            <Icon
              :name="shortcut.icon"
              class="size-4"
              aria-hidden="true"
            />
            {{ shortcut.label }}
          </NuxtLink>
          <a
            v-else
            :href="shortcut.href"
            target="_blank"
            rel="noopener"
            class="inline-flex min-h-[var(--control-min)] items-center gap-1.5 rounded-[var(--radius-control)] border border-separator bg-raised px-3 font-medium shadow-panel hover:bg-fill-hover"
          >
            <Icon
              :name="shortcut.icon"
              class="size-4"
              aria-hidden="true"
            />
            {{ shortcut.label }}
            <Icon
              name="lucide:arrow-up-right"
              class="size-3.5 text-secondary"
              aria-hidden="true"
            />
            <span class="sr-only">(se abre en Redmine)</span>
          </a>
        </template>
      </nav>

      <div class="grid items-start gap-4 wide:grid-cols-[minmax(0,1fr)_20rem]">
        <div class="flex min-w-0 flex-col gap-4">
          <UiPanel label="Tareas por tracker">
            <template #header>
              <h2 class="panel-label !text-content">
                Tareas
              </h2>
              <span class="ml-auto inline-flex gap-4 text-[length:var(--text-caption)] text-secondary">
                <NuxtLink
                  :to="issuesLink([...inProject, status('open')])"
                  class="hover:text-content hover:underline"
                ><span class="data font-semibold text-content">{{ totalOpen.data.value ?? '·' }}</span> abiertas</NuxtLink>
                <NuxtLink
                  :to="issuesLink([...inProject, status('closed')])"
                  class="hover:text-content hover:underline"
                ><span class="data font-semibold text-content">{{ totalClosed.data.value ?? '·' }}</span> cerradas</NuxtLink>
              </span>
            </template>
            <table
              v-if="trackers.length > 0"
              class="w-full border-t border-separator"
            >
              <thead class="sr-only">
                <tr>
                  <th scope="col">
                    Tracker
                  </th>
                  <th scope="col">
                    Abiertas
                  </th>
                  <th scope="col">
                    Cerradas
                  </th>
                </tr>
              </thead>
              <tbody>
                <ProjectsTrackerRow
                  v-for="(tracker, i) in trackers"
                  :key="tracker.id"
                  :tracker="tracker"
                  :project-id="project.id"
                  :class="i % 2 ? 'bg-fill-alt' : ''"
                />
              </tbody>
            </table>
            <p
              v-else
              class="border-t border-separator px-4 py-4 text-secondary"
            >
              Este proyecto no tiene trackers.
            </p>
          </UiPanel>

          <UiPanel
            v-if="description"
            label="Descripción"
          >
            <template #header>
              <h2 class="panel-label !text-content">
                Descripción
              </h2>
            </template>
            <TextRichText
              :text="description"
              class="px-4 pb-4"
            />
          </UiPanel>
        </div>

        <div class="flex flex-col gap-4">
          <UiPanel label="Próxima versión">
            <template #header>
              <h2 class="panel-label !text-content">
                Próxima versión
              </h2>
            </template>
            <div
              v-if="next"
              class="flex flex-col gap-1 px-4 pb-4"
            >
              <NuxtLink
                :to="`/projects/${project.identifier}/versions`"
                class="text-[length:var(--text-title)] font-semibold hover:underline"
              >
                {{ next.name }}
              </NuxtLink>
              <span class="text-secondary">
                <template v-if="next.due_date">{{ dueFormat.format(new Date(`${next.due_date}T00:00:00`)) }} · </template>{{ describeDaysLeft(next.due_date, today()) }}
              </span>
            </div>
            <p
              v-else
              class="px-4 pb-4 text-secondary"
            >
              No hay versiones abiertas.
            </p>
          </UiPanel>

          <UiPanel
            v-if="canSeeTime"
            label="Horas del mes"
          >
            <template #header>
              <h2 class="panel-label !text-content">
                Horas en {{ monthName }}
              </h2>
            </template>
            <p class="flex items-baseline gap-2 px-4 pb-4">
              <span class="data text-[length:var(--text-large-title)] font-semibold">{{ hours.data.value === undefined ? '·' : formatHours(hours.data.value) }}</span>
              <span class="text-secondary">registradas por el equipo</span>
            </p>
          </UiPanel>
        </div>
      </div>
    </template>
  </div>
</template>
