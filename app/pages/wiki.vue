<script setup lang="ts">
/**
 * Sección Wiki (F7): los proyectos cuya wiki puedes leer (módulo `wiki` activo y
 * `view_wiki_pages`). Con uno solo, se entra directamente.
 */
definePageMeta({ title: 'Wiki' })

const session = useSessionStore()

const projects = computed(() => session.catalogs.projects
  .filter(p => p.status !== 9 && session.can('view_wiki_pages', p.id))
  .sort((a, b) => a.name.localeCompare(b.name, 'es')))

watchEffect(() => {
  const only = projects.value.length === 1 ? projects.value[0] : undefined
  if (only) void navigateTo(`/projects/${only.identifier}/wiki`, { replace: true })
})
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 px-3 pb-6 wide:px-6">
    <UiPanel label="Wikis de tus proyectos">
      <template #header>
        <h2 class="panel-label !text-content">
          Proyectos con wiki
        </h2>
        <span class="data ml-auto text-[length:var(--text-caption)] text-secondary">{{ projects.length }}</span>
      </template>
      <ul
        v-if="projects.length > 0"
        class="flex flex-col border-t border-separator"
      >
        <li
          v-for="(project, i) in projects"
          :key="project.id"
          :class="i % 2 ? 'bg-fill-alt' : ''"
        >
          <NuxtLink
            :to="`/projects/${project.identifier}/wiki`"
            class="flex min-h-11 items-center gap-3 px-4 hover:bg-fill-hover"
          >
            <UiPlate :name="project.name" />
            <span class="min-w-0 flex-1 truncate font-medium">{{ project.name }}</span>
            <Icon
              name="lucide:chevron-right"
              class="size-4 shrink-0 text-tertiary"
              aria-hidden="true"
            />
          </NuxtLink>
        </li>
      </ul>
      <p
        v-else
        class="border-t border-separator px-4 py-8 text-center text-secondary"
      >
        Ninguno de tus proyectos tiene la wiki activada o no tienes permiso para leerla.
      </p>
    </UiPanel>
  </div>
</template>
