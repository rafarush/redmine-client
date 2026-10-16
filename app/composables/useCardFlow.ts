import type { Issue } from '../../shared/redmine/types'
import type { FlowStep, Timer } from '../../shared/workspace/flow'
import { useQueryClient } from '@tanstack/vue-query'
import { applyChange, explainRejection } from '../../shared/redmine/issue-actions'
import { formatDuration, roundHours } from '../../shared/time/duration'
import { doubleClickStep, elapsedMs, stageOf, targetStatus, timerFor } from '../../shared/workspace/flow'
import { adjacentPriority } from '../../shared/workspace/sort'

/**
 * Acciones rápidas de una card del workspace (F2c-T06). Todo va a Redmine al momento:
 *
 * - doble clic en pendiente → estado "En curso" y arranca el cronómetro;
 * - ⏸/▶ → pausa o reanuda el cronómetro (solo en local; solo uno corre a la vez);
 * - ⏹ → registra en Redmine lo medido y cierra el cronómetro (sigue en curso);
 * - doble clic en curso → estado "Completada" y registra lo que quede medido;
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

  /** Tarea cuyo tiempo se está ajustando (corrige lo último registrado o añade). */
  const adjusting = useState<Issue | null>('workspace-adjusting', () => null)
  /** Tarea en la que se registra tiempo a mano, sin cronómetro (menú "Registrar tiempo…"). */
  const logging = useState<Issue | null>('time-logging', () => null)
  const settingsOpen = useState('workspace-settings-open', () => false)
  /** Categoría de los ajustes que se abre; la misma clave que usa `SettingsDialog`. */
  const settingsTab = useState<'redmine' | 'shortcuts'>('workspace-settings-tab', () => 'redmine')

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
        settingsTab.value = 'redmine'
        settingsOpen.value = true
      } })
    }
    return status
  }

  /** Horas a registrar de un cronómetro, redondeadas al paso; 0 si no midió nada. */
  function measuredHours(timer: Timer): number {
    const ms = elapsedMs(timer, Date.now())
    return ms > 0 ? roundHours(ms / 3_600_000) : 0
  }

  /** Crea el registro de tiempo; devuelve su id o `undefined` si Redmine lo rechazó. */
  async function logTime(issue: Issue, hours: number): Promise<number | undefined> {
    try {
      const entry = await redmine.createTimeEntry({
        issue_id: issue.id,
        hours,
        activity_id: defaultActivity(),
        spent_on: today(),
      })
      workspace.rememberLogged({ issueId: issue.id, timeEntryId: entry.id, hours })
      void queryClient.invalidateQueries({ queryKey: ['time-entries'] })
      return entry.id
    }
    catch (error) {
      toasts.show(`No se pudo registrar el tiempo: ${explainRejection(error)}`, {
        label: 'Ajustar',
        run: () => {
          adjusting.value = issue
        },
      })
      return undefined
    }
  }

  /**
   * Primer doble clic: "En curso" en Redmine y cronómetro en marcha. Si la tarea
   * ya tenía uno en pausa, se reanuda. El que corriera en otra tarea queda en pausa.
   */
  async function start(issue: Issue): Promise<void> {
    if (timerFor(workspace.timers, issue.id)) {
      workspace.startTimer(issue.id)
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

  /** Sin cronómetro lo arranca (y pasa a "En curso"); con él, pausa o reanuda. */
  function toggleTimer(issue: Issue): void {
    if (timerFor(workspace.timers, issue.id)) togglePause(issue)
    else void start(issue)
  }

  /** Detalle de la tarea dentro de la app. */
  function openDetails(issue: Pick<Issue, 'id'>): void {
    void navigateTo(`/issues/${issue.id}`)
  }

  /** ⏸/▶: pausa o reanuda. No toca Redmine. */
  function togglePause(issue: Issue): void {
    const timer = timerFor(workspace.timers, issue.id)
    if (!timer) return
    if (timer.paused) workspace.startTimer(issue.id)
    else workspace.pauseTimer(issue.id)
  }

  /** ⏹: registra lo medido en Redmine y cierra el cronómetro. La tarea sigue en curso. */
  async function stop(issue: Issue): Promise<void> {
    const timer = workspace.stopTimer(issue.id)
    if (!timer) return
    const hours = measuredHours(timer)
    if (hours === 0) return
    const entryId = await logTime(issue, hours)
    if (entryId === undefined) {
      workspace.restoreTimer(timer)
      return
    }
    toasts.show(`${formatDuration(hours)} registradas en #${issue.id}`, {
      label: 'Deshacer',
      run: () => {
        workspace.restoreTimer(timer)
        void removeEntry(entryId)
      },
    })
  }

  /** Segundo doble clic: "Completada" y registra lo que quede en el cronómetro. */
  async function complete(issue: Issue): Promise<void> {
    const status = requireStatus('complete')
    if (status === undefined) return

    const timer = workspace.stopTimer(issue.id)
    const hours = timer ? measuredHours(timer) : 0
    if (!timer || hours === 0) {
      const ok = await changeAsync(issue, { status_id: status }, optimistic(issue, { status_id: status }), `#${issue.id} completada`, {
        onUndo: () => {
          if (timer) workspace.restoreTimer(timer)
        },
      })
      if (!ok && timer) workspace.restoreTimer(timer)
      // Sin nada medido (p. ej. ya se registró con ⏹), se ofrece apuntar el tiempo a mano.
      if (ok && !workspace.loggedFor(issue.id)) adjusting.value = issue
      return
    }

    // El registro se crea después de que Redmine acepte el estado; "Deshacer" lo lee entonces.
    const created: { entryId?: number } = {}
    const ok = await changeAsync(
      issue,
      { status_id: status },
      optimistic(issue, { status_id: status }),
      `#${issue.id} completada · ${formatDuration(hours)} registradas`,
      {
        onUndo: () => {
          workspace.restoreTimer(timer)
          if (created.entryId !== undefined) void removeEntry(created.entryId)
        },
      },
    )
    if (!ok) {
      workspace.restoreTimer(timer)
      return
    }
    created.entryId = await logTime(issue, hours)
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
    togglePause,
    toggleTimer,
    stop,
    openDetails,
    logging,
    bumpPriority,
    canBump,
    recentlyMoved,
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
