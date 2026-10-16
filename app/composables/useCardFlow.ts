import type { Issue } from '../../shared/redmine/types'
import type { FlowStep } from '../../shared/workspace/flow'
import { useQueryClient } from '@tanstack/vue-query'
import { applyChange, explainRejection } from '../../shared/redmine/issue-actions'
import { elapsedHours, formatDuration, roundHours } from '../../shared/time/duration'
import { doubleClickStep, stageOf, targetStatus, timerFor } from '../../shared/workspace/flow'
import { adjacentPriority } from '../../shared/workspace/sort'

/**
 * Acciones rápidas de una card del workspace (F2c-T06). Todo va a Redmine al momento:
 *
 * - doble clic en pendiente → estado "En curso" y arranca el cronómetro;
 * - doble clic en curso → estado "Completada" y registra el tiempo medido;
 * - RTQA → estado RTQA;
 * - ▲▼ → prioridad vecina.
 *
 * Cada paso deja "Deshacer" en el toast; deshacer "completar" también borra el
 * tiempo registrado y vuelve a poner el cronómetro.
 */
export function useCardFlow() {
  const redmine = useRedmine()
  const session = useSessionStore()
  const workspace = useWorkspaceStore()
  const toasts = useToastStore()
  const queryClient = useQueryClient()
  const { changeAsync } = useIssueChange()

  /** Tareas recolocadas hace poco: se marcan "Subida · ahora" hasta cambiar de vista. */
  const recentlyMoved = useState<Record<number, 'up' | 'down'>>('workspace-recently-moved', () => ({}))

  /** Tarea esperando confirmación para cambiar de cronómetro. */
  const pendingSwitch = useState<Issue | null>('workspace-pending-switch', () => null)
  /** Tarea cuyo tiempo se está ajustando. */
  const adjusting = useState<Issue | null>('workspace-adjusting', () => null)
  const settingsOpen = useState('workspace-settings-open', () => false)

  const map = computed(() => workspace.workspace.statusMap)

  function stage(issue: Issue) {
    return stageOf(issue.status.id, map.value, timerFor(workspace.timers, issue.id))
  }

  function optimistic(issue: Issue, change: { status_id?: number, priority_id?: number }): Issue {
    return applyChange(issue, change, { statuses: session.catalogs.statuses, priorities: session.catalogs.priorities, members: [] })
  }

  /** Sin mapeo no se sabe a qué estado ir: se dice y se abren los ajustes. */
  function requireStatus(step: FlowStep | 'rtqa'): number | undefined {
    const status = targetStatus(step, map.value)
    if (status === undefined) {
      const names = { start: '"En curso"', complete: '"Completada"', rtqa: '"RTQA"' }
      toasts.show(`Elige qué estado de Redmine es ${names[step]}`, { label: 'Ajustes', run: () => {
        settingsOpen.value = true
      } })
    }
    return status
  }

  async function start(issue: Issue, force = false): Promise<void> {
    const active = workspace.activeTimer
    if (active && active.issueId !== issue.id && !force) {
      pendingSwitch.value = issue
      return
    }
    const status = requireStatus('start')
    if (status === undefined) return
    workspace.startTimer(issue.id)
    const ok = await changeAsync(issue, { status_id: status }, optimistic(issue, { status_id: status }), `#${issue.id} en curso`, {
      onUndo: () => workspace.stopTimer(issue.id),
    })
    if (!ok) workspace.stopTimer(issue.id)
  }

  /** Para el cronómetro y registra el tiempo; sin cronómetro pide las horas. */
  async function complete(issue: Issue): Promise<void> {
    const status = requireStatus('complete')
    if (status === undefined) return

    const timer = workspace.stopTimer(issue.id)
    if (!timer) {
      const ok = await changeAsync(issue, { status_id: status }, optimistic(issue, { status_id: status }), `#${issue.id} completada`)
      if (ok) adjusting.value = issue
      return
    }

    const hours = roundHours(elapsedHours(timer.startedAt, Date.now()))
    let entryId: number | undefined
    const ok = await changeAsync(
      issue,
      { status_id: status },
      optimistic(issue, { status_id: status }),
      `#${issue.id} completada · ${formatDuration(hours)} registradas`,
      {
        onUndo: () => {
          workspace.restoreTimer(timer)
          if (entryId !== undefined) void removeEntry(entryId)
        },
      },
    )
    if (!ok) {
      workspace.restoreTimer(timer)
      return
    }
    try {
      const entry = await redmine.createTimeEntry({
        issue_id: issue.id,
        hours,
        activity_id: defaultActivity(),
        spent_on: today(),
      })
      entryId = entry.id
      workspace.rememberLogged({ issueId: issue.id, timeEntryId: entry.id, hours })
      void queryClient.invalidateQueries({ queryKey: ['time-entries'] })
    }
    catch (error) {
      toasts.show(`No se pudo registrar el tiempo: ${explainRejection(error)}`, {
        label: 'Ajustar',
        run: () => {
          adjusting.value = issue
        },
      })
    }
  }

  async function removeEntry(id: number): Promise<void> {
    try {
      await redmine.deleteTimeEntry(id)
      workspace.forgetLogged(id)
      void queryClient.invalidateQueries({ queryKey: ['time-entries'] })
    }
    catch (error) {
      toasts.show(explainRejection(error))
    }
  }

  async function rtqa(issue: Issue): Promise<void> {
    const status = requireStatus('rtqa')
    if (status === undefined) return
    await changeAsync(issue, { status_id: status }, optimistic(issue, { status_id: status }), `#${issue.id} en RTQA`)
  }

  function onDoubleClick(issue: Issue): void {
    const step = doubleClickStep(stage(issue))
    if (step === 'start') void start(issue)
    else if (step === 'complete') void complete(issue)
  }

  async function bumpPriority(issue: Issue, direction: 'up' | 'down'): Promise<void> {
    const next = adjacentPriority(session.catalogs.priorities, issue.priority.id, direction)
    if (!next) return
    const label = direction === 'up' ? `Prioridad de #${issue.id} subida a ${next.name}` : `Prioridad de #${issue.id} bajada a ${next.name}`
    const ok = await changeAsync(issue, { priority_id: next.id }, optimistic(issue, { priority_id: next.id }), label)
    if (ok) recentlyMoved.value = { ...recentlyMoved.value, [issue.id]: direction }
  }

  function canBump(issue: Issue, direction: 'up' | 'down'): boolean {
    return adjacentPriority(session.catalogs.priorities, issue.priority.id, direction) !== undefined
  }

  function defaultActivity(): number | undefined {
    const activities = session.catalogs.activities
    return (activities.find(a => a.is_default) ?? activities[0])?.id
  }

  return {
    stage,
    start,
    complete,
    rtqa,
    onDoubleClick,
    bumpPriority,
    canBump,
    recentlyMoved,
    pendingSwitch,
    adjusting,
    settingsOpen,
    defaultActivity,
  }
}

/** Fecha local de hoy en `AAAA-MM-DD`, la que Redmine espera en `spent_on`. */
export function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
