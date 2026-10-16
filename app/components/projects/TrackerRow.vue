<script setup lang="ts">
import type { Ref as RedmineRef } from '../../../shared/redmine/types'
import { issuesLink } from '../../../shared/redmine/projects'

/** Fila "Bug · 12 abiertas · 40 cerradas" de la página de proyecto (F6-T02); cada número filtra la lista. */
const props = defineProps<{
  tracker: RedmineRef
  projectId: number
}>()

const open = useIssueCount(() => ({ project_id: props.projectId, tracker_id: props.tracker.id, status_id: 'open' }))
const closed = useIssueCount(() => ({ project_id: props.projectId, tracker_id: props.tracker.id, status_id: 'closed' }))

function link(status: 'open' | 'closed') {
  return issuesLink([
    { field: 'project_id', operator: '=', values: [String(props.projectId)] },
    { field: 'tracker_id', operator: '=', values: [String(props.tracker.id)] },
    { field: 'status_id', operator: '=', values: [status] },
  ])
}
</script>

<template>
  <tr>
    <th
      scope="row"
      class="px-4 py-2 text-left font-normal"
    >
      {{ tracker.name }}
    </th>
    <td class="w-28 px-2 py-2 text-right">
      <NuxtLink
        :to="link('open')"
        class="text-secondary hover:text-content hover:underline"
        :aria-label="`${open.data.value ?? ''} ${tracker.name} abiertas`"
      >
        <span class="data font-semibold text-content">{{ open.data.value ?? '·' }}</span> abiertas
      </NuxtLink>
    </td>
    <td class="w-28 px-4 py-2 text-right">
      <NuxtLink
        :to="link('closed')"
        class="text-secondary hover:text-content hover:underline"
        :aria-label="`${closed.data.value ?? ''} ${tracker.name} cerradas`"
      >
        <span class="data font-semibold text-content">{{ closed.data.value ?? '·' }}</span> cerradas
      </NuxtLink>
    </td>
  </tr>
</template>
