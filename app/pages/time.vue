<script setup lang="ts">
import type { TimeEntry } from '../../shared/redmine/types'
import type { TimesheetRow } from '../../shared/time/timesheet'
import { useQuery } from '@tanstack/vue-query'
import { projectCode } from '../../shared/redmine/issue-display'
import { formatHours, parseDuration } from '../../shared/time/duration'
import { buildTimesheet, goalTone, planCellEdit, shiftWeek, weekOf } from '../../shared/time/timesheet'

/**
 * Parte semanal (F4-T06): filas = tareas con tiempo en la semana, columnas = días.
 * Cada celda se edita escribiendo la duración; con varias entradas abre el desglose.
 * Debajo, la lista de registros de la semana (F4-T07).
 *
 * La semana va en la URL (`?w=AAAA-MM-DD`, el lunes) para poder volver o compartirla.
 */
definePageMeta({ title: 'Tiempo' })

const route = useRoute()
const router = useRouter()
const redmine = useRedmine()
const session = useSessionStore()
const toasts = useToastStore()
const { create, update, remove } = useTimeEntryMutations()

const week = computed(() => weekOf(typeof route.query.w === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.w) ? route.query.w : today()))
const isThisWeek = computed(() => week.value.from === weekOf(today()).from)

function goToWeek(delta: number): void {
  const next = delta === 0 ? weekOf(today()) : shiftWeek(week.value, delta)
  void router.replace({ query: { ...route.query, w: next.from === weekOf(today()).from ? undefined : next.from } })
}

const entriesQuery = useMyTimeEntries(() => week.value.from, () => week.value.to)
const entries = computed(() => entriesQuery.data.value ?? [])

// ------------------------------------------------------- tareas añadidas a mano

/** Tareas añadidas con "Añadir tarea" que aún no tienen tiempo esta semana (solo en memoria). */
const extraIssues = ref<{ id: number, project: { id: number, name: string } }[]>([])
const sheet = computed(() => buildTimesheet(entries.value, week.value, extraIssues.value))

/** Asunto de cada tarea de las filas: una sola consulta por semana. */
const issueIds = computed(() => [...new Set(sheet.value.rows.flatMap(r => r.issueId ? [r.issueId] : []))].sort((a, b) => a - b))
const subjects = useQuery({
  queryKey: computed(() => ['issues', 'subjects', issueIds.value.join(',')]),
  queryFn: async () => ({ pages: [await redmine.listIssues({ issue_id: issueIds.value.join(','), status_id: '*', limit: 100 })] }),
  enabled: computed(() => issueIds.value.length > 0),
})
const subjectOf = computed(() => new Map((subjects.data.value?.pages[0]?.items ?? []).map(i => [i.id, i.subject])))

const adding = ref('')
const addingBusy = ref(false)
async function addIssue(): Promise<void> {
  const id = Number(adding.value.replace('#', '').trim())
  if (!Number.isInteger(id) || id <= 0) return
  if (sheet.value.rows.some(r => r.issueId === id)) {
    focusCell(sheet.value.rows.findIndex(r => r.issueId === id), todayColumn())
    adding.value = ''
    return
  }
  addingBusy.value = true
  try {
    const issue = await redmine.getIssue(id, '')
    extraIssues.value = [...extraIssues.value, { id: issue.id, project: { id: issue.project.id, name: issue.project.name } }]
    adding.value = ''
    await nextTick()
    focusCell(sheet.value.rows.findIndex(r => r.issueId === id), todayColumn())
  }
  catch {
    toasts.show(`No se encontró la tarea #${id} o no tienes acceso`)
  }
  finally {
    addingBusy.value = false
  }
}

// ---------------------------------------------------------------- edición

/**
 * Una celda vacía se puede rellenar con `log_time`; una con registros solo se toca
 * si además se pueden editar (los propios con `edit_own_time_entries`).
 */
function canEditCell(row: TimesheetRow, cell: TimeEntry[]): boolean {
  const project = row.project.id
  if (!session.can('log_time', project)) return false
  if (cell.length === 0) return true
  return session.can('edit_time_entries', project) || session.can('edit_own_time_entries', project)
}

function defaultActivity(): number | undefined {
  const activities = session.catalogs.activities
  return (activities.find(a => a.is_default) ?? activities[0])?.id
}

function target(row: TimesheetRow) {
  return row.issueId ? { issue_id: row.issueId } : { project_id: row.project.id }
}

function saveCell(row: TimesheetRow, column: number, hours: number | null): void {
  const day = week.value.days[column]!
  // Un registro que aún se está creando no tiene id: se espera a que llegue.
  if (row.cells[column]!.some(e => e.id < 0)) return
  const plan = planCellEdit(row.cells[column]!, hours)
  if (plan.kind === 'create') create.mutate({ ...target(row), project_id: row.project.id, hours: plan.hours, spent_on: day, activity_id: defaultActivity() })
  else if (plan.kind === 'update') update.mutate({ entry: row.cells[column]![0]!, changes: { hours: plan.hours } })
  else if (plan.kind === 'delete') removeWithUndo(row.cells[column]![0]!)
}

function addToCell(row: TimesheetRow, column: number, hours: number): void {
  create.mutate({ ...target(row), project_id: row.project.id, hours, spent_on: week.value.days[column]!, activity_id: defaultActivity() })
}

/** Borra y ofrece deshacer (lo vuelve a crear igual), así no hace falta confirmar. */
function removeWithUndo(entry: TimeEntry): void {
  remove.mutate(entry, {
    onSuccess: () => toasts.show(`Registro de ${formatHours(entry.hours)} borrado`, {
      label: 'Deshacer',
      run: () => create.mutate({
        issue_id: entry.issue?.id,
        project_id: entry.project.id,
        hours: entry.hours,
        spent_on: entry.spent_on,
        activity_id: entry.activity.id,
        comments: entry.comments ?? undefined,
      }),
    }),
  })
}

// --------------------------------------------------------------- teclado

const hint = ref('')
const grid = useTemplateRef<HTMLElement>('grid')

function todayColumn(): number {
  const index = week.value.days.indexOf(today())
  return index < 0 ? 0 : index
}

function focusCell(row: number, column: number): void {
  grid.value?.querySelector<HTMLElement>(`[data-cell="${row}-${column}"]`)?.focus()
}

/** Flechas entre celdas; en un campo, ← → solo saltan desde el borde del texto. */
function onGridKeydown(event: KeyboardEvent): void {
  const element = event.target as HTMLElement
  const [row, column] = (element.dataset.cell ?? '').split('-').map(Number)
  if (row === undefined || column === undefined || Number.isNaN(row)) return
  const input = element instanceof HTMLInputElement ? element : null
  const allSelected = input && input.selectionStart === 0 && input.selectionEnd === input.value.length
  const atStart = !input || allSelected || input.selectionStart === 0
  const atEnd = !input || allSelected || input.selectionEnd === input.value.length
  const moves: Record<string, [number, number] | undefined> = {
    ArrowUp: [row - 1, column],
    ArrowDown: [row + 1, column],
    ArrowLeft: atStart ? [row, column - 1] : undefined,
    ArrowRight: atEnd ? [row, column + 1] : undefined,
  }
  const next = moves[event.key]
  if (!next) return
  event.preventDefault()
  input?.dispatchEvent(new Event('change'))
  focusCell(next[0], next[1])
}

// ------------------------------------------------------------- objetivo

const GOAL_KEY = 'redmine-client:daily-goal'
const goal = ref(8)
const goalText = ref('8')
onMounted(() => {
  try {
    const saved = Number(localStorage.getItem(GOAL_KEY))
    if (saved >= 0 && saved <= 24 && localStorage.getItem(GOAL_KEY) !== null) goal.value = saved
  }
  catch {
    // Sin almacenamiento se queda el objetivo por defecto.
  }
  goalText.value = goal.value ? formatHours(goal.value) : ''
})

function saveGoal(): void {
  const hours = goalText.value.trim() ? parseDuration(goalText.value) : 0
  if (hours === null) {
    goalText.value = goal.value ? formatHours(goal.value) : ''
    return
  }
  goal.value = hours
  goalText.value = hours ? formatHours(hours) : ''
  try {
    localStorage.setItem(GOAL_KEY, String(hours))
  }
  catch {
    // Ver arriba.
  }
}

const TONE = {
  none: { bar: 'bg-separator', text: 'text-secondary', icon: '', label: '' },
  under: { bar: 'bg-warning', text: 'text-warning', icon: 'lucide:circle-alert', label: 'Faltan' },
  met: { bar: 'bg-success', text: 'text-success', icon: 'lucide:circle-check', label: 'Cumplido' },
  over: { bar: 'bg-success', text: 'text-success', icon: 'lucide:circle-plus', label: 'De más' },
} as const

function dayStatus(hours: number) {
  const tone = goalTone(hours, goal.value)
  const diff = Math.abs(goal.value - hours)
  const detail = tone === 'under' ? `Faltan ${formatHours(diff)}` : tone === 'over' ? `${formatHours(diff)} de más` : tone === 'met' ? 'Objetivo cumplido' : ''
  return { tone, detail, ...TONE[tone], fill: goal.value ? Math.min(100, (hours / goal.value) * 100) : 0 }
}

// ---------------------------------------------------------------- formato

const weekday = new Intl.DateTimeFormat('es', { weekday: 'short' })
const dayMonth = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' })
const longDay = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'short' })
const asDate = (day: string) => new Date(`${day}T00:00:00`)
const clean = (text: string) => text.replace('.', '')

const weekLabel = computed(() => `${clean(dayMonth.format(asDate(week.value.from)))} – ${clean(dayMonth.format(asDate(week.value.to)))}`)

function rowLabel(row: TimesheetRow): string {
  return row.issueId ? `Tarea #${row.issueId}` : `${row.project.name} (sin tarea)`
}

function openIssue(id: number): void {
  void navigateTo(`/issues/${id}`)
}
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 px-3 pb-6 wide:px-6">
    <UiPanel label="Parte semanal">
      <template #header>
        <nav
          aria-label="Semana"
          class="flex items-center gap-1"
        >
          <UiButton
            label="Semana anterior"
            icon="lucide:chevron-left"
            icon-only
            variant="ghost"
            @click="goToWeek(-1)"
          />
          <h2 class="data whitespace-nowrap text-[length:var(--text-title)] font-semibold">
            {{ weekLabel }}
          </h2>
          <UiButton
            label="Semana siguiente"
            icon="lucide:chevron-right"
            icon-only
            variant="ghost"
            @click="goToWeek(1)"
          />
          <UiButton
            v-if="!isThisWeek"
            label="Esta semana"
            variant="ghost"
            @click="goToWeek(0)"
          />
        </nav>
        <span
          v-if="entriesQuery.isFetching.value"
          class="text-[length:var(--text-caption)] text-secondary"
          aria-live="polite"
        >Actualizando…</span>
        <span class="ml-auto inline-flex items-baseline gap-2">
          <span class="panel-label">Semana</span>
          <span class="data text-[length:var(--text-title)] font-semibold">{{ formatHours(sheet.total) }}</span>
        </span>
      </template>

      <div
        v-if="entriesQuery.isPending.value"
        class="flex flex-col gap-2 px-4 pb-4"
        aria-busy="true"
        aria-label="Cargando el parte"
      >
        <div
          v-for="n in 4"
          :key="n"
          class="h-9 rounded-[var(--radius-control)] bg-fill-selected motion-safe:animate-pulse"
        />
      </div>

      <div
        v-else-if="entriesQuery.error.value"
        role="alert"
        class="flex flex-col items-center gap-3 px-4 py-10 text-center"
      >
        <p class="text-secondary">
          No se pudo leer el tiempo de esta semana.
        </p>
        <UiButton
          label="Reintentar"
          icon="lucide:rotate-cw"
          @click="entriesQuery.refetch()"
        />
      </div>

      <div
        v-else
        class="overflow-x-auto"
      >
        <table
          ref="grid"
          class="w-full min-w-[46rem] border-collapse text-[length:var(--text-body)]"
          aria-label="Horas por tarea y día"
          @keydown="onGridKeydown"
        >
          <thead>
            <tr class="text-[length:var(--text-caption)] text-secondary">
              <th
                scope="col"
                class="px-4 py-2 text-left font-medium"
              >
                Tarea
              </th>
              <th
                v-for="day in week.days"
                :key="day"
                scope="col"
                class="w-[4.5rem] px-1 py-2 text-center font-medium"
                :class="day === today() ? 'text-content' : ''"
                :aria-label="longDay.format(asDate(day))"
              >
                <span class="block uppercase tracking-[0.06em]">{{ clean(weekday.format(asDate(day))) }}</span>
                <span
                  class="data block"
                  :class="day === today() ? 'font-semibold' : ''"
                >{{ asDate(day).getDate() }}</span>
              </th>
              <th
                scope="col"
                class="w-20 px-4 py-2 text-right font-medium"
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, r) in sheet.rows"
              :key="row.key"
              :class="r % 2 ? 'bg-fill-alt' : ''"
            >
              <th
                scope="row"
                class="max-w-0 px-4 py-1 text-left font-normal"
              >
                <span class="flex min-w-0 items-center gap-2">
                  <UiPlate
                    :name="row.project.name"
                    :code="projectCode(row.project.name)"
                  />
                  <button
                    v-if="row.issueId"
                    type="button"
                    class="flex min-w-0 items-baseline gap-2 rounded-[var(--radius-plate)] text-left hover:underline"
                    @click="openIssue(row.issueId)"
                  >
                    <span class="data shrink-0 text-secondary">#{{ row.issueId }}</span>
                    <span class="truncate">{{ subjectOf.get(row.issueId) ?? '' }}</span>
                  </button>
                  <span
                    v-else
                    class="truncate text-secondary"
                  >{{ row.project.name }} · sin tarea</span>
                </span>
              </th>
              <td
                v-for="(cell, c) in row.cells"
                :key="week.days[c]"
                class="px-1 py-1"
                :class="week.days[c] === today() ? 'bg-fill-selected/40' : ''"
              >
                <TimeTimesheetCell
                  :entries="cell"
                  :cell="`${r}-${c}`"
                  :label="`${rowLabel(row)}, ${longDay.format(asDate(week.days[c]!))}`"
                  :editable="canEditCell(row, cell)"
                  @save="saveCell(row, c, $event)"
                  @update="(entry, hours) => update.mutate({ entry, changes: { hours } })"
                  @remove="removeWithUndo"
                  @add="addToCell(row, c, $event)"
                  @hint="hint = $event"
                />
              </td>
              <td class="data px-4 py-1 text-right font-semibold">
                {{ row.total ? formatHours(row.total) : '' }}
              </td>
            </tr>

            <tr v-if="sheet.rows.length === 0">
              <td
                :colspan="9"
                class="px-4 py-8 text-center text-secondary"
              >
                {{ isThisWeek ? 'Aún no has registrado tiempo esta semana.' : 'No registraste tiempo esa semana.' }}
                Añade una tarea abajo para empezar.
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t border-separator">
              <th
                scope="row"
                class="px-4 py-2 text-left"
              >
                <form
                  v-can="'log_time'"
                  class="flex items-center gap-2"
                  @submit.prevent="addIssue"
                >
                  <input
                    v-model="adding"
                    type="text"
                    inputmode="numeric"
                    placeholder="Nº tarea"
                    aria-label="Número de la tarea a añadir"
                    class="data h-9 w-24 rounded-[var(--radius-control)] border border-separator bg-surface px-2"
                  >
                  <UiButton
                    type="submit"
                    label="Añadir tarea"
                    icon="lucide:plus"
                    variant="ghost"
                    :disabled="addingBusy || !adding.trim()"
                  />
                </form>
              </th>
              <td
                v-for="(hours, c) in sheet.dayTotals"
                :key="week.days[c]"
                class="px-1 py-2 align-top"
              >
                <div
                  class="flex flex-col items-center gap-1"
                  :title="dayStatus(hours).detail"
                >
                  <span class="data font-semibold">{{ hours ? formatHours(hours) : '' }}</span>
                  <span
                    v-if="goal && hours"
                    class="h-1 w-10 overflow-hidden rounded-full bg-separator"
                    aria-hidden="true"
                  >
                    <span
                      class="block h-full rounded-full"
                      :class="dayStatus(hours).bar"
                      :style="{ width: `${dayStatus(hours).fill}%` }"
                    />
                  </span>
                  <span
                    v-if="goal && hours"
                    class="inline-flex items-center gap-0.5 text-[length:var(--text-caption)]"
                    :class="dayStatus(hours).text"
                  >
                    <Icon
                      :name="dayStatus(hours).icon"
                      class="size-3"
                      aria-hidden="true"
                    />
                    <span class="sr-only">{{ dayStatus(hours).detail }}</span>
                    <span aria-hidden="true">{{ dayStatus(hours).tone === 'under' ? `−${formatHours(goal - hours)}` : dayStatus(hours).tone === 'over' ? `+${formatHours(hours - goal)}` : '' }}</span>
                  </span>
                </div>
              </td>
              <td class="data px-4 py-2 text-right align-top text-[length:var(--text-title)] font-semibold">
                {{ formatHours(sheet.total) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-separator px-4 py-2 text-[length:var(--text-caption)] text-secondary">
        <p
          class="min-h-5 flex-1"
          aria-live="polite"
        >
          {{ hint || 'Escribe "1h30", "1:30", "1,5" o "45" (min) y pulsa Enter. Vacía la celda para borrar.' }}
        </p>
        <label class="inline-flex items-center gap-2">
          Objetivo diario
          <input
            v-model="goalText"
            type="text"
            inputmode="decimal"
            placeholder="sin objetivo"
            class="data h-8 w-20 rounded-[var(--radius-control)] border border-separator bg-surface px-2 text-center text-content"
            @change="saveGoal"
            @keydown.enter.prevent="saveGoal"
          >
        </label>
      </div>
    </UiPanel>

    <TimeEntryList
      :entries="entries"
      :subjects="subjectOf"
      :days="week.days"
      @remove="removeWithUndo"
    />
  </div>
</template>
