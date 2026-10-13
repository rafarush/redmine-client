/**
 * Modelo de permisos del usuario actual (tarea F1-T05). Ver sdd/03-api-redmine.md › Permisos.
 *
 * Se arma con GET /users/current.json?include=memberships,groups + GET /roles/:id.json por rol.
 * Los nombres son los símbolos de permiso de Redmine (`view_issues`, `add_issues`, `log_time`, ...).
 */
export type RedminePermission = string

export interface PermissionMap {
  admin: boolean
  byProject: Map<number, Set<RedminePermission>>
}
