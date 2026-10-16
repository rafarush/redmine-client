<script setup lang="ts">
import type { Issue, Version } from '../../../../../shared/redmine/types'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { explainRejection } from '../../../../../shared/redmine/issue-actions'
import { describeDaysLeft, issuesLink, versionProgress } from '../../../../../shared/redmine/projects'

/**
 * Detalle de una versión (F6-T04): avance, tareas agrupadas por estado (en el
 * orden del catálogo) y, con `manage_versions`, editar fecha, estado y
 * descripción. "Abrir en la lista" lleva a la tabla de F2 con la versión filtrada.
 */
definePageMeta({ title: 'Versión' })

const route = useRoute()
const redmine = useRedmine()
const session = useSessionStore()
const toasts = useToastStore()
const queryClient = useQueryClient()

const project = useProjectRef(() => String(route.params.id))
const versionId = computed(() => Number(route.params.versionId))

const version = useQuery({
  queryKey: computed(() => ['version', versionId.value]),
  queryFn: () => redmine.getVersion(versionId.value),
  enabled: computed(() => Number.isInteger(versionId.value) && versionId.value > 0),
})
const issues = useVersionIssues(versionId)

const pageTitle = useState<string | null>('page-title')
watchEffect(() => {
  pageTitle.value = version.data.value?.name ?? null
})
onBeforeUnmount(() => {
  pageTitle.value = null
})

const statusOrder = computed(() => session.catalogs.statuses)
const closedIds = computed(() => new Set(statusOrder.value.filter(s => s.is_closed).map(s => s.id)))
const progress = computed(() => issues.data.value
  ? versionProgress(issues.data.value.map(i => ({ closed: closedIds.value.has(i.status.id), done_ratio: i.done_ratio, estimated_hours: i.estimated_hours })))
  : undefined)

/** Grupos por estado en el orden del catálogo; los estados vacíos no salen. */
const groups = computed(() => {
  const byStatus = new Map<number, Issue[]>()
  for (const issue of issues.data.value ?? []) byStatus.set(issue.status.id, [...(byStatus.get(issue.status.id) ?? []), issue])
  const known = statusOrder.value.filter(s => byStatus.has(s.id)).map(s => ({ id: s.id, name: s.name, closed: s.is_closed }))
  const unknown = [...byStatus.keys()].filter(id => !statusOrder.value.some(s => s.id === id))
    .map(id => ({ id, name: byStatus.get(id)![0]!.status.name, closed: false }))
  return [...known, ...unknown].map(s => ({ ...s, issues: byStatus.get(s.id)!.sort((a, b) => a.id - b.id) }))
})

const router = useRouter()
/** `UiButton` recibe la ruta como texto: se resuelve el enlace con su `?f=`. */
const listLink = computed(() => router.resolve(issuesLink([
  { field: 'fixed_version_id', operator: '=', values: [String(versionId.value)] },
  { field: 'status_id', operator: '*', values: [] },
])).fullPath)

const dueFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' })
const STATUS_LABEL: Record<Version['status'], string> = { open: 'Abierta', locked: 'Bloqueada', closed: 'Cerrada' }

// ------------------------------------------------------------------ editar

/** La versión es del proyecto que la comparte: se edita con el permiso de ese proyecto. */
const canManage = computed(() => {
  const owner = version.data.value?.project?.id ?? project.value?.id
  return owner !== undefined && session.can('manage_versions', owner)
})
const editing = ref(false)
const form = reactive<{ due_date: string, status: Version['status'], description: string }>({ due_date: '', status: 'open', description: '' })
const saving = ref(false)

function edit(): void {
  const v = version.data.value
  if (!v) return
  form.due_date = v.due_date ?? ''
  form.status = v.status
  form.description = v.description ?? ''
  editing.value = true
}

async function save(): Promise<void> {
  if (saving.value) return
  saving.value = true
  try {
    await redmine.updateVersion(versionId.value, { due_date: form.due_date || null, status: form.status, description: form.description })
    editing.value = false
    toasts.show('Versión guardada')
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['version', versionId.value] }),
      queryClient.invalidateQueries({ queryKey: ['project-versions'] }),
      queryClient.invalidateQueries({ queryKey: ['versions'] }),
    ])
  }
  catch (error) {
    toasts.show(`No se pudo guardar la versión: ${explainRejection(error)}`)
  }
  finally {
    saving.value = false
  }
}

const FIELD = 'min-h-[var(--control-min)] rounded-[var(--radius-control)] border border-separator bg-surface px-2.5'
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 px-3 pb-6 wide:px-6">
    <Teleport
      defer
      to="#toolbar-actions"
    >
      <UiButton
        v-if="project"
        label="Volver al roadmap"
        icon="lucide:arrow-left"
        icon-only
        variant="ghost"
        :to="`/projects/${project.identifier}/versions`"
      />
      <UiButton
        label="Abrir en la lista"
        icon="lucide:list"
        icon-only
        variant="ghost"
        :to="listLink"
      />
    </Teleport>

    <div
      v-if="version.isPending.value"
      class="h-40 rounded-[var(--radius-surface)] bg-fill-selected motion-safe:animate-pulse"
      aria-busy="true"
      aria-label="Cargando la versión"
    />
    <div
      v-else-if="version.error.value || !version.data.value"
      role="alert"
      class="flex flex-col items-center gap-3 py-16 text-center"
    >
      <p class="text-secondary">
        No se pudo abrir la versión. Puede que no exista o que no tengas acceso.
      </p>
      <UiButton
        label="Reintentar"
        icon="lucide:rotate-cw"
        @click="version.refetch()"
      />
    </div>

    <template v-else>
      <UiPanel label="Resumen de la versión">
        <div class="flex flex-col gap-3 px-4 py-4">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-secondary">
            <span class="inline-flex items-center gap-1">
              <Icon
                :name="version.data.value.status === 'open' ? 'lucide:circle-dot' : version.data.value.status === 'locked' ? 'lucide:lock' : 'lucide:circle-check'"
                class="size-4"
                aria-hidden="true"
              />
              {{ STATUS_LABEL[version.data.value.status] }}
            </span>
            <span v-if="version.data.value.due_date">
              <span class="data">{{ dueFormat.format(new Date(`${version.data.value.due_date}T00:00:00`)) }}</span>
              <template v-if="version.data.value.status === 'open'"> · {{ describeDaysLeft(version.data.value.due_date, today()) }}</template>
            </span>
            <span
              v-if="version.data.value.project && version.data.value.project.id !== project?.id"
            >Compartida desde {{ version.data.value.project.name }}</span>
            <UiButton
              v-if="canManage && !editing"
              label="Editar versión"
              icon="lucide:pencil"
              class="ml-auto"
              @click="edit"
            />
          </div>

          <div
            v-if="progress"
            class="flex items-center gap-3"
          >
            <div
              class="h-2 flex-1 overflow-hidden rounded-full bg-fill-selected"
              role="progressbar"
              :aria-valuenow="Math.floor(progress.percent)"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="Avance de la versión"
              :aria-valuetext="progress.label"
            >
              <div
                class="h-full rounded-full bg-success"
                :style="{ width: `${progress.percent}%` }"
              />
            </div>
            <span class="data shrink-0 text-secondary">{{ progress.label }}</span>
          </div>

          <p
            v-if="version.data.value.description && !editing"
            class="text-secondary"
          >
            {{ version.data.value.description }}
          </p>

          <form
            v-if="editing"
            class="flex flex-col gap-3 border-t border-separator pt-3"
            @submit.prevent="save"
          >
            <div class="flex flex-wrap gap-3">
              <label class="flex flex-col gap-1">
                <span class="panel-label">Fecha</span>
                <input
                  v-model="form.due_date"
                  type="date"
                  :class="[FIELD, 'data']"
                >
              </label>
              <label class="flex flex-col gap-1">
                <span class="panel-label">Estado</span>
                <UiSelect
                  v-model="form.status"
                  :options="[{ value: 'open', label: 'Abierta' }, { value: 'locked', label: 'Bloqueada' }, { value: 'closed', label: 'Cerrada' }]"
                />
              </label>
            </div>
            <label class="flex flex-col gap-1">
              <span class="panel-label">Descripción</span>
              <input
                v-model="form.description"
                type="text"
                :class="FIELD"
              >
            </label>
            <div class="flex justify-end gap-2">
              <UiButton
                label="Cancelar"
                variant="ghost"
                @click="editing = false"
              />
              <UiButton
                type="submit"
                :label="saving ? 'Guardando…' : 'Guardar versión'"
                variant="primary"
                :disabled="saving"
              />
            </div>
          </form>
        </div>
      </UiPanel>

      <div
        v-if="issues.isPending.value"
        class="flex flex-col gap-2"
        aria-busy="true"
        aria-label="Cargando las tareas"
      >
        <div
          v-for="n in 4"
          :key="n"
          class="h-10 rounded-[var(--radius-control)] bg-fill-selected motion-safe:animate-pulse"
        />
      </div>
      <p
        v-else-if="groups.length === 0"
        class="py-8 text-center text-secondary"
      >
        Esta versión no tiene tareas.
      </p>

      <UiPanel
        v-for="group in groups"
        v-else
        :key="group.id"
        :label="group.name"
      >
        <template #header>
          <Icon
            :name="group.closed ? 'lucide:circle-check' : 'lucide:circle-dot'"
            class="size-4 text-secondary"
            aria-hidden="true"
          />
          <h2 class="panel-label !text-content">
            {{ group.name }}
          </h2>
          <span class="data ml-auto text-[length:var(--text-caption)] text-secondary">{{ group.issues.length }}</span>
        </template>
        <ul class="flex flex-col border-t border-separator">
          <li
            v-for="(issue, i) in group.issues"
            :key="issue.id"
            :class="i % 2 ? 'bg-fill-alt' : ''"
          >
            <NuxtLink
              :to="`/issues/${issue.id}`"
              class="grid min-h-10 grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-1 hover:bg-fill-hover wide:grid-cols-[4rem_minmax(0,1fr)_8rem_10rem_3.5rem]"
            >
              <span class="data text-secondary">#{{ issue.id }}</span>
              <span class="truncate">{{ issue.subject }}</span>
              <span class="hidden truncate text-secondary wide:block">{{ issue.tracker.name }}</span>
              <span class="hidden truncate text-secondary wide:block">{{ issue.assigned_to?.name ?? 'Sin asignar' }}</span>
              <span class="data text-right text-secondary">{{ issue.done_ratio }} %</span>
            </NuxtLink>
          </li>
        </ul>
      </UiPanel>
    </template>
  </div>
</template>
