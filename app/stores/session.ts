import type { RedmineClient } from '../../shared/redmine/client'
import type { PermissionMap, RedminePermission } from '../../shared/redmine/permissions'
import type { CurrentUser, Enumeration, IssueStatus, Project, Ref, RoleDetail } from '../../shared/redmine/types'
import { defineStore } from 'pinia'
// Importes explícitos (no auto-imports) para que el store se pueda montar en un
// test suelto, sin el runtime de Nuxt.
import { computed, ref } from 'vue'
import { buildPermissionMap, can as canDo, projectsWith } from '../../shared/redmine/permissions'
import { RedmineError } from '../../shared/redmine/transport'

const URL_KEY = 'redmine-client:last-url'

interface Catalogs {
  projects: Project[]
  trackers: Ref[]
  statuses: IssueStatus[]
  priorities: Enumeration[]
  activities: Enumeration[]
}

const EMPTY_CATALOGS: Catalogs = { projects: [], trackers: [], statuses: [], priorities: [], activities: [] }

/**
 * Usuario, permisos y catálogos de la sesión (F1-T06).
 * Orden de carga en sdd/03-api-redmine.md › Arranque de sesión.
 */
export const useSessionStore = defineStore('session', () => {
  const user = ref<CurrentUser | null>(null)
  const url = ref('')
  const catalogs = ref<Catalogs>({ ...EMPTY_CATALOGS })
  const permissions = ref<PermissionMap | null>(null)
  const loading = ref(false)
  /** Mensaje para la pantalla de conexión cuando la sesión se cae sola. */
  const entryNotice = ref('')

  const connected = computed(() => user.value !== null)
  const name = computed(() => user.value ? `${user.value.firstname} ${user.value.lastname}`.trim() : '')
  const initials = computed(() =>
    user.value ? `${user.value.firstname[0] ?? ''}${user.value.lastname[0] ?? ''}`.toUpperCase() : '',
  )

  /** Última URL usada, para rellenarla en la pantalla de conexión. */
  function rememberedUrl(): string {
    try {
      return localStorage.getItem(URL_KEY) ?? ''
    }
    catch {
      return ''
    }
  }

  function rememberUrl(value: string): void {
    try {
      localStorage.setItem(URL_KEY, value)
    }
    catch {
      // Sin almacenamiento solo se pierde la comodidad de tenerla escrita.
    }
  }

  /** Carga perfil, catálogos y permisos. Se llama tras conectar y al arrancar con sesión. */
  async function load(client: RedmineClient): Promise<void> {
    loading.value = true
    try {
      const current = await client.getCurrentUser()
      user.value = current

      const [projects, trackers, statuses, priorities, activities] = await Promise.all([
        client.listProjects(),
        client.listTrackers(),
        client.listIssueStatuses(),
        client.listPriorities(),
        client.listTimeEntryActivities(),
      ])
      catalogs.value = { projects, trackers, statuses, priorities, activities }

      permissions.value = await buildPermissions(client, current, projects)
    }
    finally {
      loading.value = false
    }
  }

  async function buildPermissions(
    client: RedmineClient,
    current: CurrentUser,
    projects: Project[],
  ): Promise<PermissionMap> {
    // Un admin puede todo: no hace falta pedir los roles.
    if (current.admin) return buildPermissionMap(current, new Map(), projects)

    const ids = [...new Set(current.memberships.flatMap(m => m.roles.map(r => r.id)))]
    const details = new Map<number, RoleDetail>()

    try {
      const roles = await Promise.all(ids.map(id => client.getRole(id)))
      for (const role of roles) details.set(role.id, role)
    }
    catch (error) {
      // Instancia antigua o restringida: se muestran las acciones y manda Redmine.
      if (error instanceof RedmineError && (error.status === 403 || error.status === 404)) {
        return buildPermissionMap(current, new Map(), projects, { degraded: true })
      }
      throw error
    }

    return buildPermissionMap(current, details, projects)
  }

  /** Vuelve a leer los permisos tras un 403, sin tocar el resto de la sesión. */
  async function refreshPermissions(): Promise<void> {
    const client = useNuxtApp().$redmine as RedmineClient | undefined
    if (!client || !user.value) return
    try {
      permissions.value = await buildPermissions(client, user.value, catalogs.value.projects)
    }
    catch {
      // Si tampoco se pueden leer ahora, se queda el mapa anterior.
    }
  }

  function clear(): void {
    user.value = null
    catalogs.value = { ...EMPTY_CATALOGS }
    permissions.value = null
  }

  async function disconnect(): Promise<void> {
    await $fetch('/api/session/logout', { method: 'POST' })
    clear()
    useNuxtApp().$queryClient?.clear()
  }

  /** La clave dejó de valer: se limpia todo y se avisa en la pantalla de conexión. */
  async function closeOnInvalidKey(): Promise<void> {
    entryNotice.value = 'Tu clave de API ya no es válida. Pega una nueva para seguir.'
    try {
      await $fetch('/api/session/logout', { method: 'POST' })
    }
    catch {
      // La sesión ya podía estar cerrada en el servidor.
    }
    clear()
    useNuxtApp().$queryClient?.clear()
  }

  /** ¿Puede el usuario hacer esto? Sin proyecto, responde si puede en alguno. */
  function can(permission: RedminePermission, projectId?: number): boolean {
    return permissions.value ? canDo(permissions.value, permission, projectId) : false
  }

  /** Proyectos donde el usuario tiene ese permiso, p. ej. para elegir dónde crear. */
  function projectsAllowing(permission: RedminePermission): Project[] {
    return permissions.value ? projectsWith(permissions.value, permission, catalogs.value.projects) : []
  }

  return {
    user,
    url,
    catalogs,
    permissions,
    loading,
    entryNotice,
    connected,
    name,
    initials,
    rememberedUrl,
    rememberUrl,
    load,
    refreshPermissions,
    disconnect,
    closeOnInvalidKey,
    can,
    projectsAllowing,
  }
})
