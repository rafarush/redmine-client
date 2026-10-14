// @vitest-environment node
import type { CurrentUser, Project, RoleDetail } from '../../shared/redmine/types'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildPermissionMap, can, projectsWith } from '../../shared/redmine/permissions'
import { currentUserSchema, projectSchema, roleDetailSchema } from '../../shared/redmine/types'

/**
 * Permisos contra datos reales del Redmine local (F1-T05).
 * El caso que importa: el rol Cliente no puede registrar tiempo.
 */
const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url))
const readFixture = (file: string) => JSON.parse(readFileSync(`${FIXTURES}${file}`, 'utf8'))

const user = currentUserSchema.parse(
  readFixture('users_current-include-memberships-groups.json').user,
) as CurrentUser

const projects = readFixture('projects-include-trackers-enabled_modules-limit-100.json')
  .projects.map((p: unknown) => projectSchema.parse(p)) as Project[]

const roles = new Map<number, RoleDetail>(
  [3, 4, 5, 6]
    .map(id => roleDetailSchema.parse(readFixture(`roles_${id}.json`).role))
    .map(role => [role.id, role]),
)

const roleByName = (name: string) => [...roles.values()].find(r => r.name === name)!
const PORTAL_WEB = projects.find(p => p.identifier === 'portal-web')!.id

function mapWithRole(roleName: string): ReturnType<typeof buildPermissionMap> {
  const role = roleByName(roleName)
  const asUser: CurrentUser = {
    ...user,
    memberships: projects.map((p, i) => ({ id: i + 1, project: { id: p.id, name: p.name }, roles: [role] })),
  }
  return buildPermissionMap(asUser, roles, projects)
}

describe('permisos', () => {
  it('el desarrollador puede ver tareas y registrar tiempo', () => {
    const map = buildPermissionMap(user, roles, projects)
    expect(can(map, 'view_issues', PORTAL_WEB)).toBe(true)
    expect(can(map, 'log_time', PORTAL_WEB)).toBe(true)
    expect(can(map, 'add_issues', PORTAL_WEB)).toBe(true)
  })

  it('el cliente ve tareas pero no registra tiempo', () => {
    const map = mapWithRole('Cliente')
    expect(can(map, 'view_issues', PORTAL_WEB)).toBe(true)
    expect(can(map, 'log_time', PORTAL_WEB)).toBe(false)
    expect(can(map, 'edit_issues', PORTAL_WEB)).toBe(false)
  })

  it('niega el permiso si el módulo está apagado, aunque el rol lo tenga', () => {
    const withoutTime = projects.map(p => ({
      ...p,
      enabled_modules: p.enabled_modules?.filter(m => m.name !== 'time_tracking'),
    }))
    const map = buildPermissionMap(user, roles, withoutTime)

    expect(can(map, 'log_time', PORTAL_WEB)).toBe(false)
    expect(can(map, 'view_issues', PORTAL_WEB)).toBe(true)
  })

  it('el administrador puede todo, sin membresías', () => {
    const admin: CurrentUser = { ...user, admin: true, memberships: [] }
    const map = buildPermissionMap(admin, new Map(), projects)

    expect(can(map, 'log_time', PORTAL_WEB)).toBe(true)
    expect(can(map, 'delete_issues', PORTAL_WEB)).toBe(true)
  })

  it('el administrador tampoco puede si el módulo está apagado', () => {
    const admin: CurrentUser = { ...user, admin: true, memberships: [] }
    const withoutWiki = projects.map(p => ({
      ...p,
      enabled_modules: p.enabled_modules?.filter(m => m.name !== 'wiki'),
    }))
    expect(can(buildPermissionMap(admin, new Map(), withoutWiki), 'view_wiki_pages', PORTAL_WEB)).toBe(false)
  })

  it('en un proyecto sin membresía no puede nada', () => {
    const map = buildPermissionMap({ ...user, memberships: [] }, roles, projects)
    expect(can(map, 'view_issues', PORTAL_WEB)).toBe(false)
  })

  it('el modo degradado permite y deja que Redmine decida', () => {
    const map = buildPermissionMap(user, new Map(), projects, { degraded: true })
    expect(map.degraded).toBe(true)
    expect(can(map, 'log_time', PORTAL_WEB)).toBe(true)
    // El módulo sigue mandando incluso en modo degradado.
    const withoutTime = projects.map(p => ({
      ...p,
      enabled_modules: p.enabled_modules?.filter(m => m.name !== 'time_tracking'),
    }))
    expect(can(buildPermissionMap(user, new Map(), withoutTime, { degraded: true }), 'log_time', PORTAL_WEB)).toBe(false)
  })

  it('sin proyecto, responde si puede en alguno', () => {
    const map = mapWithRole('Cliente')
    expect(can(map, 'view_issues')).toBe(true)
    expect(can(map, 'log_time')).toBe(false)
  })

  it('lista los proyectos donde puede crear tareas', () => {
    expect(projectsWith(buildPermissionMap(user, roles, projects), 'add_issues', projects))
      .toHaveLength(projects.length)
    expect(projectsWith(mapWithRole('Cliente'), 'edit_issues', projects)).toHaveLength(0)
  })
})
