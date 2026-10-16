import type { MaybeRefOrGetter } from 'vue'
import type { ImportCatalog } from '../../shared/import/model'
import { useQuery } from '@tanstack/vue-query'
import { computed, toValue } from 'vue'
import { customFieldsFromAdmin } from '../../shared/redmine/filter-fields'

/**
 * Catálogo de un proyecto para la importación (F5): tipos, estados, prioridades,
 * miembros, versiones abiertas, categorías y campos personalizados. Los valores
 * de las listas personalizadas solo se conocen con permisos de admin; sin ellos,
 * esos campos se rellenan como texto libre.
 */
export function useImportCatalog(projectId: MaybeRefOrGetter<number | undefined>) {
  const redmine = useRedmine()
  const session = useSessionStore()
  const id = computed(() => toValue(projectId))

  const detail = useProjectDetail(id)
  const versions = useProjectVersions(id)
  const members = useQuery({
    queryKey: computed(() => ['members', id.value]),
    queryFn: () => redmine.listProjectMembers(id.value!),
    enabled: computed(() => id.value !== undefined),
    staleTime: 10 * 60_000,
  })
  const adminFields = useQuery({
    queryKey: ['custom-fields'],
    queryFn: async () => customFieldsFromAdmin(await redmine.listCustomFields()),
    enabled: computed(() => !!session.user?.admin),
    staleTime: 30 * 60_000,
    retry: false,
  })

  const ready = computed(() => detail.isSuccess.value && versions.isSuccess.value && members.isSuccess.value)

  const catalog = computed<ImportCatalog | undefined>(() => {
    const project = detail.data.value
    if (!ready.value || !project) return undefined
    const options = new Map((adminFields.data.value ?? []).map(f => [f.id, f.options?.map(o => o.value)]))
    return {
      project: { id: project.id, identifier: project.identifier, name: project.name },
      trackers: project.trackers ?? [],
      statuses: session.catalogs.statuses.map(s => ({ id: s.id, name: s.name })),
      priorities: session.catalogs.priorities.map(p => ({ id: p.id, name: p.name })),
      members: members.data.value ?? [],
      versions: (versions.data.value ?? []).filter(v => v.status === 'open').map(v => ({ id: v.id, name: v.name })),
      categories: project.issue_categories ?? [],
      customFields: (project.issue_custom_fields ?? []).map(f => ({ id: f.id, name: f.name, options: options.get(f.id) })),
    }
  })

  return { catalog, ready, error: computed(() => detail.error.value ?? versions.error.value ?? members.error.value) }
}
