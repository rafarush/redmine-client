import type { IssueChange } from '../../shared/redmine/issue-actions'
import type { Issue } from '../../shared/redmine/types'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { explainRejection, isNoop, toRedminePayload } from '../../shared/redmine/issue-actions'

/**
 * Cambio rápido de una tarea desde la lista (F2-T08).
 *
 * El llamador dice qué cambia (`change`) y cómo se verá al instante (`optimistic`,
 * la tarea entera ya cambiada). Se pinta en todas las páginas cacheadas; si Redmine
 * lo rechaza se vuelve a la instantánea anterior y el toast explica por qué. Lo
 * aceptado ofrece "Deshacer", que es el cambio inverso con la instantánea de antes.
 */

interface ChangeVars {
  issue: Issue
  change: IssueChange
  optimistic: Issue
  label: string
  undoable: boolean
  /** Lo que hay que deshacer además del cambio (p. ej. borrar el tiempo registrado). */
  onUndo?: () => void
}

export interface ChangeOptions {
  /** Se llama al pulsar "Deshacer", además de devolver la tarea a como estaba. */
  onUndo?: () => void
  /** Sin "Deshacer" en el toast. */
  undoable?: boolean
}

type IssueList = { pages: { items: Issue[] }[] }

export function useIssueChange() {
  const redmine = useRedmine()
  const queryClient = useQueryClient()
  const toasts = useToastStore()

  /** Reemplaza una tarea en todas las listas cacheadas. */
  function patchLists(id: number, replacement: Issue): void {
    queryClient.setQueriesData<IssueList>({ queryKey: ['issues'] }, (data) => {
      if (!data) return data
      return {
        ...data,
        pages: data.pages.map(page => ({
          ...page,
          items: page.items.map(item => item.id === id ? replacement : item),
        })),
      }
    })
  }

  const mutation = useMutation({
    mutationFn: ({ issue, change }: ChangeVars) => redmine.updateIssue(issue.id, toRedminePayload(change)),
    onMutate: async (vars: ChangeVars) => {
      await queryClient.cancelQueries({ queryKey: ['issues'] })
      patchLists(vars.issue.id, vars.optimistic)
      return { before: vars.issue }
    },
    onError: (error, vars, context) => {
      if (context) patchLists(vars.issue.id, context.before)
      toasts.show(explainRejection(error))
    },
    onSuccess: (_data, vars, context) => {
      void queryClient.invalidateQueries({ queryKey: ['issues'] })
      toasts.show(vars.label, vars.undoable && context
        ? { label: 'Deshacer', run: () => {
            undo(context.before)
            vars.onUndo?.()
          } }
        : undefined)
    },
  })

  function undo(before: Issue): void {
    mutation.mutate({
      issue: before,
      change: {
        status_id: before.status.id,
        priority_id: before.priority.id,
        assigned_to_id: before.assigned_to?.id ?? null,
      },
      optimistic: before,
      label: 'Cambio deshecho',
      undoable: false,
    })
  }

  /** Aplica un cambio. Si la tarea ya tiene ese valor, no llama a Redmine. */
  function change(issue: Issue, next: IssueChange, optimistic: Issue, label: string, options: ChangeOptions = {}): void {
    void changeAsync(issue, next, optimistic, label, options)
  }

  /**
   * Igual que `change`, pero dice si Redmine lo aceptó, para encadenar lo que
   * depende de ello (el flujo del workspace). El rechazo ya lo explica el toast.
   */
  async function changeAsync(issue: Issue, next: IssueChange, optimistic: Issue, label: string, options: ChangeOptions = {}): Promise<boolean> {
    if (isNoop(issue, next)) return true
    try {
      await mutation.mutateAsync({ issue, change: next, optimistic, label, undoable: options.undoable ?? true, onUndo: options.onUndo })
      return true
    }
    catch {
      return false
    }
  }

  return { change, changeAsync, isPending: computed(() => mutation.isPending.value) }
}
