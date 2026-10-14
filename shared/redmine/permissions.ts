import type { CurrentUser, Project, RoleDetail } from './types'

/**
 * Qué puede hacer el usuario en cada proyecto (F1-T05).
 * Ver sdd/03-api-redmine.md › Permisos.
 *
 * Se arma con /users/current.json?include=memberships + /roles/:id.json por rol.
 * Un permiso vale solo si además el módulo que lo cubre está activo en el proyecto.
 */
export type RedminePermission = string

/** Módulo de Redmine que tiene que estar activo para que el permiso sirva. */
const MODULO_POR_PERMISO: Record<string, string> = {
  view_issues: 'issue_tracking',
  add_issues: 'issue_tracking',
  edit_issues: 'issue_tracking',
  edit_own_issues: 'issue_tracking',
  delete_issues: 'issue_tracking',
  add_issue_notes: 'issue_tracking',
  manage_subtasks: 'issue_tracking',
  manage_issue_relations: 'issue_tracking',
  manage_versions: 'issue_tracking',
  manage_categories: 'issue_tracking',
  save_queries: 'issue_tracking',
  view_time_entries: 'time_tracking',
  log_time: 'time_tracking',
  edit_time_entries: 'time_tracking',
  edit_own_time_entries: 'time_tracking',
  view_wiki_pages: 'wiki',
  edit_wiki_pages: 'wiki',
  delete_wiki_pages: 'wiki',
  view_news: 'news',
  manage_news: 'news',
  comment_news: 'news',
  view_files: 'files',
  manage_files: 'files',
}

export interface PermissionMap {
  /** Un administrador puede todo, sin mirar roles. */
  admin: boolean
  /** Permisos por id de proyecto, unión de los roles de sus membresías. */
  byProject: Map<number, Set<RedminePermission>>
  /** Módulos activos por id de proyecto. */
  modulesByProject: Map<number, Set<string>>
  /**
   * No se pudieron leer los roles (instancia antigua o restringida). En ese caso
   * se muestran las acciones y se oculta cada una al primer 403.
   * Ver sdd/01-arquitectura.md › Errores.
   */
  degraded: boolean
}

export function buildPermissionMap(
  user: CurrentUser,
  roles: Map<number, RoleDetail>,
  projects: Project[],
  options: { degraded?: boolean } = {},
): PermissionMap {
  const byProject = new Map<number, Set<RedminePermission>>()
  const modulesByProject = new Map<number, Set<string>>()

  for (const project of projects) {
    modulesByProject.set(project.id, new Set(project.enabled_modules?.map(m => m.name) ?? []))
  }

  for (const membership of user.memberships) {
    const acumulados = byProject.get(membership.project.id) ?? new Set<RedminePermission>()
    for (const rol of membership.roles) {
      for (const permiso of roles.get(rol.id)?.permissions ?? []) acumulados.add(permiso)
    }
    byProject.set(membership.project.id, acumulados)
  }

  return { admin: user.admin, byProject, modulesByProject, degraded: options.degraded ?? false }
}

/**
 * ¿Puede el usuario hacer `permission` en `projectId`?
 *
 * Sin `projectId` responde si puede en **algún** proyecto: sirve para decidir si
 * una acción global (por ejemplo "Nueva tarea" en la toolbar) tiene sentido.
 */
export function can(map: PermissionMap, permission: RedminePermission, projectId?: number): boolean {
  if (projectId === undefined) {
    if (map.admin || map.degraded) return [...map.modulesByProject.keys()].some(id => can(map, permission, id))
    return [...map.byProject.keys()].some(id => can(map, permission, id))
  }

  const modulo = MODULO_POR_PERMISO[permission]
  const modulos = map.modulesByProject.get(projectId)
  // Si no sabemos los módulos del proyecto, no bloqueamos por esa vía.
  if (modulo && modulos && !modulos.has(modulo)) return false

  if (map.admin) return true
  if (map.degraded) return true

  return map.byProject.get(projectId)?.has(permission) ?? false
}

/** Proyectos donde el usuario puede hacer algo, p. ej. para el selector de "Nueva tarea". */
export function projectsWith(
  map: PermissionMap,
  permission: RedminePermission,
  projects: Project[],
): Project[] {
  return projects.filter(project => can(map, permission, project.id))
}
