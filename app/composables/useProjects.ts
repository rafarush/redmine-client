import type { MaybeRefOrGetter } from 'vue'
import type { Issue, Project, TimeEntry } from '../../shared/redmine/types'
import { useQuery } from '@tanstack/vue-query'
import { computed, toValue } from 'vue'

/**
 * Datos de proyectos y versiones (F6). Los catálogos de la sesión ya traen los
 * proyectos; aquí se piden los números (tareas abiertas, horas, avance) cuando una
 * fila o una página los necesita, con caché de unos minutos.
 */

const STALE = 2 * 60_000

/** Proyecto del catálogo por id o identificador (`/projects/portal-web`). */
export function useProjectRef(idOrIdentifier: MaybeRefOrGetter<string | number>) {
  const session = useSessionStore()
  return computed<Project | undefined>(() => {
    const key = String(toValue(idOrIdentifier))
    return session.catalogs.projects.find(p => p.identifier === key || String(p.id) === key)
  })
}

/** Proyecto completo, con categorías, campos y actividades. */
export function useProjectDetail(id: MaybeRefOrGetter<number | undefined>) {
  const redmine = useRedmine()
  return useQuery({
    queryKey: computed(() => ['project', toValue(id)]),
    queryFn: () => redmine.getProject(toValue(id)!),
    enabled: computed(() => toValue(id) !== undefined),
    staleTime: STALE,
  })
}

/** Versiones de un proyecto (incluye las compartidas que ve). */
export function useProjectVersions(id: MaybeRefOrGetter<number | undefined>) {
  const redmine = useRedmine()
  return useQuery({
    queryKey: computed(() => ['project-versions', toValue(id)]),
    queryFn: () => redmine.listVersions(toValue(id)!),
    enabled: computed(() => toValue(id) !== undefined),
    staleTime: STALE,
  })
}

/** Número de tareas que cumplen `query`: una página de 1 y su `total_count`. */
export function useIssueCount(query: MaybeRefOrGetter<Record<string, string | number> | undefined>) {
  const redmine = useRedmine()
  return useQuery({
    queryKey: computed(() => ['issue-count', toValue(query)]),
    queryFn: async () => (await redmine.listIssues({ ...toValue(query), limit: 1 })).totalCount,
    enabled: computed(() => toValue(query) !== undefined),
    staleTime: STALE,
  })
}

/** Todas las tareas de una versión (abiertas y cerradas), para su avance. */
export function useVersionIssues(versionId: MaybeRefOrGetter<number>, enabled: MaybeRefOrGetter<boolean> = true) {
  const redmine = useRedmine()
  return useQuery({
    queryKey: computed(() => ['version-issues', toValue(versionId)]),
    queryFn: async () => {
      const all: Issue[] = []
      for (let offset = 0; ; offset += 100) {
        const page = await redmine.listIssues({ fixed_version_id: toValue(versionId), status_id: '*', limit: 100, offset })
        all.push(...page.items)
        if (page.items.length === 0 || all.length >= page.totalCount) return all
      }
    },
    enabled: computed(() => toValue(enabled)),
    staleTime: STALE,
  })
}

/** Horas registradas en un proyecto entre dos fechas (de todo el equipo que pueda ver). */
export function useProjectHours(
  projectId: MaybeRefOrGetter<number | undefined>,
  from: MaybeRefOrGetter<string>,
  to: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  const redmine = useRedmine()
  return useQuery({
    queryKey: computed(() => ['time-entries', 'project', toValue(projectId), toValue(from), toValue(to)]),
    queryFn: async () => {
      const all: TimeEntry[] = []
      for (let offset = 0; ; offset += 100) {
        const page = await redmine.listTimeEntries({ project_id: toValue(projectId), from: toValue(from), to: toValue(to), limit: 100, offset })
        all.push(...page.items)
        if (page.items.length === 0 || all.length >= page.totalCount) break
      }
      return Math.round(all.reduce((sum, e) => sum + e.hours, 0) * 100) / 100
    },
    enabled: computed(() => toValue(projectId) !== undefined && toValue(enabled)),
    staleTime: STALE,
  })
}
