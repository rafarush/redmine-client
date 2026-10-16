<script setup lang="ts">
import { sortVersions } from '../../../../shared/redmine/projects'

/**
 * Roadmap del proyecto (F6-T03): versiones abiertas (y bloqueadas) por fecha con
 * su avance; las cerradas van plegadas al final y se calculan al desplegarlas.
 */
definePageMeta({ title: 'Roadmap' })

const route = useRoute()
const project = useProjectRef(() => String(route.params.id))
const versions = useProjectVersions(() => project.value?.id)

const pageTitle = useState<string | null>('page-title')
watchEffect(() => {
  pageTitle.value = project.value ? `Roadmap · ${project.value.name}` : null
})
onBeforeUnmount(() => {
  pageTitle.value = null
})

const active = computed(() => sortVersions((versions.data.value ?? []).filter(v => v.status !== 'closed')))
const closed = computed(() => sortVersions((versions.data.value ?? []).filter(v => v.status === 'closed')).reverse())
const showClosed = ref(false)
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 px-3 pb-6 wide:px-6">
    <Teleport
      defer
      to="#toolbar-actions"
    >
      <UiButton
        v-if="project"
        :label="`Volver a ${project.name}`"
        icon="lucide:arrow-left"
        icon-only
        variant="ghost"
        :to="`/projects/${project.identifier}`"
      />
    </Teleport>

    <p
      v-if="!project"
      role="alert"
      class="py-16 text-center text-secondary"
    >
      No encuentro el proyecto "{{ route.params.id }}".
    </p>

    <template v-else>
      <UiPanel label="Versiones abiertas">
        <template #header>
          <h2 class="panel-label !text-content">
            Abiertas
          </h2>
          <span class="data ml-auto text-[length:var(--text-caption)] text-secondary">{{ active.length }}</span>
        </template>
        <div
          v-if="versions.isPending.value"
          class="flex flex-col gap-3 px-4 pb-4"
          aria-busy="true"
          aria-label="Cargando versiones"
        >
          <div
            v-for="n in 3"
            :key="n"
            class="h-16 rounded-[var(--radius-control)] bg-fill-selected motion-safe:animate-pulse"
          />
        </div>
        <div
          v-else-if="versions.error.value"
          role="alert"
          class="flex flex-col items-center gap-3 px-4 py-8 text-center"
        >
          <p class="text-secondary">
            No se pudieron leer las versiones.
          </p>
          <UiButton
            label="Reintentar"
            icon="lucide:rotate-cw"
            @click="versions.refetch()"
          />
        </div>
        <ol
          v-else-if="active.length > 0"
          class="flex flex-col divide-y divide-separator border-t border-separator"
        >
          <li
            v-for="version in active"
            :key="version.id"
          >
            <ProjectsVersionCard
              :version="version"
              :project-id="project.id"
              load
            />
          </li>
        </ol>
        <p
          v-else
          class="border-t border-separator px-4 py-6 text-secondary"
        >
          No hay versiones abiertas en este proyecto.
        </p>
      </UiPanel>

      <UiPanel
        v-if="closed.length > 0"
        label="Versiones cerradas"
      >
        <template #header>
          <button
            type="button"
            class="flex min-h-[var(--control-min)] flex-1 items-center gap-2 text-left"
            :aria-expanded="showClosed"
            aria-controls="closed-versions"
            @click="showClosed = !showClosed"
          >
            <Icon
              :name="showClosed ? 'lucide:chevron-down' : 'lucide:chevron-right'"
              class="size-4 text-secondary"
              aria-hidden="true"
            />
            <h2 class="panel-label !text-content">
              Cerradas
            </h2>
            <span class="data ml-auto text-[length:var(--text-caption)] text-secondary">{{ closed.length }}</span>
          </button>
        </template>
        <ol
          v-show="showClosed"
          id="closed-versions"
          class="flex flex-col divide-y divide-separator border-t border-separator"
        >
          <li
            v-for="version in closed"
            :key="version.id"
          >
            <ProjectsVersionCard
              :version="version"
              :project-id="project.id"
              :load="showClosed"
            />
          </li>
        </ol>
      </UiPanel>
    </template>
  </div>
</template>
