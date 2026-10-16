<script setup lang="ts">
import { ISSUES_PATH } from '../../shared/redmine/views'

/**
 * Workspace (F2c): la pantalla de inicio. Boards de tareas asignadas a mí, con la
 * franja de salidas arriba. Los enlaces antiguos a la lista (`/?f=`, `/?q=`) se
 * redirigen a `/issues` para no romper filtros compartidos.
 */
definePageMeta({
  title: 'Workspace',
  middleware: [
    (to) => {
      if (to.query.f !== undefined || to.query.q !== undefined) {
        return navigateTo({ path: ISSUES_PATH, query: to.query }, { replace: true })
      }
    },
  ],
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <WorkspaceCanvas />
  </div>
</template>
