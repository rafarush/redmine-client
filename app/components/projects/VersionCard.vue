<script setup lang="ts">
import type { Version } from '../../../shared/redmine/types'
import { describeDaysLeft, issuesLink, versionProgress } from '../../../shared/redmine/projects'
import { formatHours } from '../../../shared/time/duration'

/**
 * Una versión del roadmap (F6-T03): barra de avance con el texto "18 de 25 · 72 %"
 * (calculado como Redmine), fecha y días que quedan, estimado frente a registrado.
 * Las tareas se piden solo cuando la versión se ve (las cerradas, al desplegarlas).
 */
const props = defineProps<{
  version: Version
  /** Para el enlace a sus tareas. */
  projectId: number
  /** Para el enlace a su detalle. */
  projectIdentifier: string
  load: boolean
}>()

const session = useSessionStore()
const issues = useVersionIssues(() => props.version.id, () => props.load)

const closedIds = computed(() => new Set(session.catalogs.statuses.filter(s => s.is_closed).map(s => s.id)))
const progress = computed(() => issues.data.value
  ? versionProgress(issues.data.value.map(i => ({ closed: closedIds.value.has(i.status.id), done_ratio: i.done_ratio, estimated_hours: i.estimated_hours })))
  : undefined)

/** Redmine ≥ 5 da `estimated_hours` y `spent_hours` en la versión; si no, se suman las tareas. */
const estimated = computed(() => numberField('estimated_hours') ?? sum(i => i.estimated_hours))
const spent = computed(() => numberField('spent_hours') ?? sum(i => i.spent_hours))

function numberField(key: 'estimated_hours' | 'spent_hours'): number | undefined {
  const value = (props.version as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : undefined
}

function sum(pick: (issue: NonNullable<typeof issues.data.value>[number]) => number | null | undefined): number | undefined {
  return issues.data.value?.reduce((total, issue) => total + (pick(issue) ?? 0), 0)
}

const dueFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' })
const overdue = computed(() => props.version.status === 'open' && !!props.version.due_date && props.version.due_date < today() && (progress.value?.percent ?? 0) < 100)

const link = computed(() => issuesLink([
  { field: 'project_id', operator: '=', values: [String(props.projectId)] },
  { field: 'fixed_version_id', operator: '=', values: [String(props.version.id)] },
  { field: 'status_id', operator: '*', values: [] },
]))
</script>

<template>
  <article
    class="flex flex-col gap-2 px-4 py-3"
    :aria-label="`Versión ${version.name}`"
  >
    <header class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h3 class="text-[length:var(--text-title)] font-semibold">
        <NuxtLink
          :to="`/projects/${projectIdentifier}/versions/${version.id}`"
          class="hover:underline"
        >{{ version.name }}</NuxtLink>
      </h3>
      <span
        v-if="version.status !== 'open'"
        class="inline-flex items-center gap-1 text-[length:var(--text-caption)] text-secondary"
      >
        <Icon
          :name="version.status === 'locked' ? 'lucide:lock' : 'lucide:circle-check'"
          class="size-3"
          aria-hidden="true"
        />
        {{ version.status === 'locked' ? 'Bloqueada' : 'Cerrada' }}
      </span>
      <span
        v-if="version.project && version.project.id !== projectId"
        class="text-[length:var(--text-caption)] text-secondary"
      >Compartida desde {{ version.project.name }}</span>
      <span
        class="ml-auto inline-flex items-center gap-1 text-[length:var(--text-caption)]"
        :class="overdue ? 'font-semibold text-warning' : 'text-secondary'"
      >
        <Icon
          v-if="overdue"
          name="lucide:circle-alert"
          class="size-3.5"
          aria-hidden="true"
        />
        <span
          v-if="version.due_date"
          class="data"
        >{{ dueFormat.format(new Date(`${version.due_date}T00:00:00`)) }}</span>
        <template v-if="version.status === 'open'">
          <span aria-hidden="true">·</span>{{ describeDaysLeft(version.due_date, today()) }}
        </template>
      </span>
    </header>

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
        :aria-label="`Avance de ${version.name}`"
        :aria-valuetext="progress.label"
      >
        <div
          class="h-full rounded-full bg-success"
          :style="{ width: `${progress.percent}%` }"
        />
      </div>
      <NuxtLink
        :to="link"
        class="data shrink-0 text-secondary hover:text-content hover:underline"
      >{{ progress.label }}</NuxtLink>
    </div>
    <div
      v-else-if="load"
      class="h-2 rounded-full bg-fill-selected motion-safe:animate-pulse"
      aria-label="Calculando el avance"
    />

    <p
      v-if="estimated !== undefined || spent !== undefined"
      class="flex gap-4 text-[length:var(--text-caption)] text-secondary"
    >
      <span>Estimado <span class="data text-content">{{ estimated ? formatHours(estimated) : '—' }}</span></span>
      <span>Registrado <span class="data text-content">{{ spent ? formatHours(spent) : '—' }}</span></span>
    </p>
    <p
      v-if="version.description"
      class="text-secondary"
    >
      {{ version.description }}
    </p>
  </article>
</template>
