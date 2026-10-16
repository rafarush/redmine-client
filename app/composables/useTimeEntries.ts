import type { MaybeRefOrGetter } from 'vue'
import type { Issue, TimeEntry } from '../../shared/redmine/types'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { explainRejection } from '../../shared/redmine/issue-actions'

/**
 * Registros de tiempo (F4-T02): los míos en un rango de fechas y los de una tarea,
 * más crear, ajustar y borrar.
 *
 * Las mutaciones son optimistas en las consultas `['time-entries', …]` y, si el
 * registro es de una tarea, suman o restan sus horas en las listas `['issues']`
 * (que tienen forma `{ pages }`). Al terminar se revalida todo lo de tiempo.
 */

type IssueList = { pages: { items: Issue[] }[] }

export interface TimeEntryInput {
  issue_id?: number
  project_id?: number
  hours: number
  spent_on: string
  activity_id?: number
  comments?: string
}

/** Mis registros entre `from` y `to` (ambos incluidos). Recorre todas las páginas. */
export function useMyTimeEntries(from: MaybeRefOrGetter<string>, to: MaybeRefOrGetter<string>) {
  const redmine = useRedmine()
  return useQuery({
    queryKey: computed(() => ['time-entries', 'range', toValue(from), toValue(to)]),
    queryFn: async () => {
      const all: TimeEntry[] = []
      for (let offset = 0; ; offset += 100) {
        const page = await redmine.listTimeEntries({ user_id: 'me', from: toValue(from), to: toValue(to), limit: 100, offset })
        all.push(...page.items)
        if (page.items.length === 0 || all.length >= page.totalCount) return all
      }
    },
    placeholderData: keepPreviousData,
  })
}

/** Registros de una tarea, de todo el mundo, los más recientes primero. */
export function useIssueTimeEntries(issueId: MaybeRefOrGetter<number>) {
  const redmine = useRedmine()
  return useQuery({
    queryKey: computed(() => ['time-entries', 'issue', toValue(issueId)]),
    queryFn: async () => (await redmine.listTimeEntries({ issue_id: toValue(issueId), limit: 100 })).items,
  })
}

export function useTimeEntryMutations() {
  const redmine = useRedmine()
  const queryClient = useQueryClient()
  const toasts = useToastStore()
  const session = useSessionStore()

  /** Suma `delta` horas a la tarea en todas las listas cacheadas. */
  function bumpIssueHours(issueId: number | undefined, delta: number): void {
    if (!issueId || !delta) return
    queryClient.setQueriesData<IssueList>({ queryKey: ['issues'] }, (data) => {
      if (!data?.pages) return data
      return {
        ...data,
        pages: data.pages.map(page => ({
          ...page,
          items: page.items.map(item => item.id === issueId
            ? { ...item, spent_hours: Math.max(0, (item.spent_hours ?? 0) + delta) }
            : item),
        })),
      }
    })
  }

  /** Aplica `edit` a cada lista de registros cacheada y devuelve cómo estaban. */
  async function patchEntries(edit: (list: TimeEntry[], key: readonly unknown[]) => TimeEntry[]) {
    await queryClient.cancelQueries({ queryKey: ['time-entries'] })
    const before = queryClient.getQueriesData<unknown>({ queryKey: ['time-entries'] })
    for (const [key, data] of before) {
      if (Array.isArray(data)) queryClient.setQueryData(key, edit(data as TimeEntry[], key))
    }
    return before
  }

  function restore(before: [readonly unknown[], unknown][] | undefined): void {
    for (const [key, data] of before ?? []) queryClient.setQueryData(key, data)
  }

  function settle(): void {
    void queryClient.invalidateQueries({ queryKey: ['time-entries'] })
    void queryClient.invalidateQueries({ queryKey: ['issues'] })
  }

  function projectRef(input: TimeEntryInput, fallback?: { id: number, name: string }) {
    const project = session.catalogs.projects.find(p => p.id === input.project_id)
    return project ? { id: project.id, name: project.name } : fallback ?? { id: input.project_id ?? 0, name: '' }
  }

  const create = useMutation({
    mutationFn: (input: TimeEntryInput) => redmine.createTimeEntry({ ...input }),
    onMutate: async (input) => {
      // Fila provisional con id negativo hasta que Redmine devuelva la real.
      const activity = session.catalogs.activities.find(a => a.id === input.activity_id)
      const draft: TimeEntry = {
        id: -Date.now(),
        project: projectRef(input),
        issue: input.issue_id ? { id: input.issue_id } : undefined,
        user: { id: session.user?.id ?? 0, name: session.name },
        activity: activity ? { id: activity.id, name: activity.name } : { id: 0, name: '' },
        hours: input.hours,
        comments: input.comments ?? '',
        spent_on: input.spent_on,
        created_on: new Date().toISOString(),
        updated_on: new Date().toISOString(),
      }
      const before = await patchEntries((list, key) => belongsTo(key, draft) ? [...list, draft] : list)
      bumpIssueHours(input.issue_id, input.hours)
      return { before, draftId: draft.id }
    },
    onSuccess: (created, _input, context) => {
      // La provisional pasa a tener el id real ya, sin esperar a la revalidación:
      // así se puede ajustar o borrar en seguida.
      for (const [key, data] of queryClient.getQueriesData<unknown>({ queryKey: ['time-entries'] })) {
        if (Array.isArray(data)) queryClient.setQueryData(key, (data as TimeEntry[]).map(e => e.id === context.draftId ? created : e))
      }
    },
    onError: (error, input, context) => {
      restore(context?.before)
      bumpIssueHours(input.issue_id, -input.hours)
      toasts.show(`No se pudo registrar el tiempo: ${explainRejection(error)}`)
    },
    onSettled: settle,
  })

  const update = useMutation({
    mutationFn: ({ entry, changes }: { entry: TimeEntry, changes: Partial<TimeEntryInput> }) =>
      redmine.updateTimeEntry(entry.id, { ...changes }),
    onMutate: async ({ entry, changes }) => {
      const before = await patchEntries(list => list.map(item => item.id === entry.id ? { ...item, ...pickEntryFields(changes) } : item))
      const delta = changes.hours !== undefined ? changes.hours - entry.hours : 0
      bumpIssueHours(entry.issue?.id, delta)
      return { before, delta }
    },
    onError: (error, { entry }, context) => {
      restore(context?.before)
      bumpIssueHours(entry.issue?.id, -(context?.delta ?? 0))
      toasts.show(`No se pudo ajustar el tiempo: ${explainRejection(error)}`)
    },
    onSettled: settle,
  })

  const remove = useMutation({
    mutationFn: (entry: TimeEntry) => redmine.deleteTimeEntry(entry.id),
    onMutate: async (entry) => {
      const before = await patchEntries(list => list.filter(item => item.id !== entry.id))
      bumpIssueHours(entry.issue?.id, -entry.hours)
      return { before }
    },
    onError: (error, entry, context) => {
      restore(context?.before)
      bumpIssueHours(entry.issue?.id, entry.hours)
      toasts.show(`No se pudo borrar el registro: ${explainRejection(error)}`)
    },
    onSettled: settle,
  })

  return { create, update, remove }
}

/** Si un registro nuevo entra en la lista cacheada con esa clave (rango o tarea). */
function belongsTo(key: readonly unknown[], entry: TimeEntry): boolean {
  const [, kind, a, b] = key
  if (kind === 'range') return typeof a === 'string' && typeof b === 'string' && entry.spent_on >= a && entry.spent_on <= b
  if (kind === 'issue') return entry.issue?.id === a
  return false
}

function pickEntryFields(changes: Partial<TimeEntryInput>): Partial<TimeEntry> {
  const out: Partial<TimeEntry> = {}
  if (changes.hours !== undefined) out.hours = changes.hours
  if (changes.comments !== undefined) out.comments = changes.comments
  if (changes.spent_on !== undefined) out.spent_on = changes.spent_on
  return out
}
