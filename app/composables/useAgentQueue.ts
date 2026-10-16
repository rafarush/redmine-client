import type { QueueItem, QueueStatus } from '../../shared/agent/model'
import { applyChange } from '../../shared/redmine/issue-actions'
import { canApplyStatus, statusForPhase } from '../../shared/agent/status'

/**
 * Acciones de la Cola de Agente para la interfaz (F11-T04, T07): añadir, quitar,
 * reordenar, reintentar, cancelar y pausar; y aplicar en Redmine el estado de cada
 * fase con `useIssueChange`, respetando el workflow (`allowed_statuses`).
 */
export function useAgentQueue() {
  const store = useAgentStore()
  const runner = useAgentRunner()
  const redmine = useRedmine()
  const session = useSessionStore()
  const toasts = useToastStore()
  const { changeAsync } = useIssueChange()
  /** Conectado al SSE del runner (lo mantiene `agent/QueueEngine.vue`). */
  const connected = useState('agent-connected', () => false)

  function add(issue: { id: number, subject: string }): void {
    if (store.add({ id: issue.id, title: issue.subject })) toasts.show(`#${issue.id} añadida a la cola del agente`, { label: 'Ver cola', run: () => {
      void navigateTo('/agent')
    } })
    else toasts.show(`#${issue.id} ya está en la cola`)
  }

  function retry(item: QueueItem): void {
    store.setStatus(item.id, 'queued')
  }

  async function cancel(item: QueueItem): Promise<void> {
    if (item.status === 'working' || item.status === 'testing') {
      try {
        await runner.cancel(item.id)
      }
      catch (error) {
        toasts.show((error as Error).message)
      }
      return
    }
    store.setStatus(item.id, 'cancelled')
  }

  /** Estado de Redmine de la fase, si está mapeado; si el workflow no deja, avisa y sigue. */
  async function applyStatus(item: QueueItem, phase: QueueStatus): Promise<void> {
    const target = statusForPhase(store.config.statusMap, phase)
    if (target === undefined) return
    try {
      const issue = await redmine.getIssue(item.issueId, 'allowed_statuses')
      const verdict = canApplyStatus(target, issue.status.id, issue.allowed_statuses)
      const name = session.catalogs.statuses.find(s => s.id === target)?.name ?? `#${target}`
      if (verdict === 'already') return
      if (verdict === 'not_allowed') {
        toasts.show(`Redmine no deja pasar #${item.issueId} a "${name}"; la cola sigue`)
        return
      }
      const optimistic = applyChange(issue, { status_id: target }, { statuses: session.catalogs.statuses, priorities: session.catalogs.priorities, members: [] })
      await changeAsync(issue, { status_id: target }, optimistic, `#${item.issueId} → ${name}`, { undoable: false })
    }
    catch {
      toasts.show(`No se pudo cambiar el estado de #${item.issueId} en Redmine; la cola sigue`)
    }
  }

  return { store, runner, connected, add, retry, cancel, applyStatus }
}
