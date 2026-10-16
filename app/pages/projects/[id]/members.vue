<script setup lang="ts">
import type { MemberRow } from '../../../../shared/redmine/members'
import { useQuery } from '@tanstack/vue-query'
import { countByRole, groupMembers } from '../../../../shared/redmine/members'
import { issuesLink } from '../../../../shared/redmine/projects'

/**
 * Miembros del proyecto (F6-T05): personas y grupos con sus roles. Cada fila lleva
 * a "tareas asignadas a esa persona (o grupo) en este proyecto".
 */
definePageMeta({ title: 'Miembros' })

const route = useRoute()
const redmine = useRedmine()
const project = useProjectRef(() => String(route.params.id))
const id = computed(() => project.value?.id)

const pageTitle = useState<string | null>('page-title')
watchEffect(() => {
  pageTitle.value = project.value ? `Miembros · ${project.value.name}` : null
})
onBeforeUnmount(() => {
  pageTitle.value = null
})

const memberships = useQuery({
  queryKey: computed(() => ['memberships', id.value]),
  queryFn: () => redmine.listProjectMemberships(id.value!),
  enabled: computed(() => id.value !== undefined),
  staleTime: 5 * 60_000,
})
const members = computed(() => groupMembers(memberships.data.value ?? []))
const roles = computed(() => countByRole(members.value.people))

/**
 * Número de personas de cada grupo. Redmine solo lo enseña a administradores; si
 * responde 403, el grupo se muestra sin número.
 */
const groupSizes = useQuery({
  queryKey: computed(() => ['group-sizes', members.value.groups.map(g => g.id)]),
  queryFn: async () => {
    const entries = await Promise.all(members.value.groups.map(async (group) => {
      try {
        return [group.id, (await redmine.getGroupUsers(group.id)).length] as const
      }
      catch {
        return [group.id, undefined] as const
      }
    }))
    return new Map(entries)
  },
  enabled: computed(() => members.value.groups.length > 0),
  staleTime: 5 * 60_000,
})

function assignedLink(row: MemberRow) {
  return issuesLink([
    { field: 'project_id', operator: '=', values: [String(id.value)] },
    { field: 'assigned_to_id', operator: '=', values: [String(row.id)] },
    { field: 'status_id', operator: '=', values: ['open'] },
  ])
}

const SECTIONS = computed(() => [
  { key: 'people', title: 'Personas', icon: 'lucide:user-round', rows: members.value.people },
  { key: 'groups', title: 'Grupos', icon: 'lucide:users-round', rows: members.value.groups },
])
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

    <div
      v-else-if="memberships.isPending.value"
      class="flex flex-col gap-2"
      aria-busy="true"
      aria-label="Cargando miembros"
    >
      <div
        v-for="n in 4"
        :key="n"
        class="h-11 rounded-[var(--radius-control)] bg-fill-selected motion-safe:animate-pulse"
      />
    </div>

    <div
      v-else-if="memberships.error.value"
      role="alert"
      class="flex flex-col items-center gap-3 py-10 text-center"
    >
      <p class="text-secondary">
        No se pudieron leer los miembros de este proyecto.
      </p>
      <UiButton
        label="Reintentar"
        icon="lucide:rotate-cw"
        @click="memberships.refetch()"
      />
    </div>

    <template v-else>
      <template
        v-for="section in SECTIONS"
        :key="section.key"
      >
        <UiPanel
          v-if="section.key === 'people' || section.rows.length > 0"
          :label="section.title"
        >
          <template #header>
            <h2 class="panel-label !text-content">
              {{ section.title }}
            </h2>
            <span
              v-if="section.key === 'people'"
              class="ml-auto truncate text-[length:var(--text-caption)] text-secondary"
            >{{ roles.map(r => `${r.count} ${r.role}`).join(' · ') }}</span>
          </template>
          <ul
            v-if="section.rows.length > 0"
            class="flex flex-col border-t border-separator"
          >
            <li
              v-for="(row, i) in section.rows"
              :key="row.id"
              :class="i % 2 ? 'bg-fill-alt' : ''"
            >
              <NuxtLink
                :to="assignedLink(row)"
                class="flex min-h-11 items-center gap-3 px-4 hover:bg-fill-hover"
                :aria-label="`Tareas abiertas ${row.kind === 'group' ? 'del grupo' : 'de'} ${row.name} en ${project.name}`"
              >
                <Icon
                  :name="section.icon"
                  class="size-4 shrink-0 text-secondary"
                  aria-hidden="true"
                />
                <span class="min-w-0 flex-1 truncate font-medium">
                  {{ row.name }}
                  <span
                    v-if="row.kind === 'group' && groupSizes.data.value?.get(row.id) !== undefined"
                    class="data font-normal text-secondary"
                  >· {{ groupSizes.data.value?.get(row.id) }} personas</span>
                </span>
                <span class="truncate text-secondary">{{ row.roles.join(', ') }}</span>
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
            class="border-t border-separator px-4 py-6 text-secondary"
          >
            Este proyecto no tiene miembros visibles.
          </p>
        </UiPanel>
      </template>
    </template>
  </div>
</template>
