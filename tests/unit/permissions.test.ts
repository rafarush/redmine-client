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
const leer = (archivo: string) => JSON.parse(readFileSync(`${FIXTURES}${archivo}`, 'utf8'))

const usuario = currentUserSchema.parse(
  leer('users_current-include-memberships-groups.json').user,
) as CurrentUser

const proyectos = leer('projects-include-trackers-enabled_modules-limit-100.json')
  .projects.map((p: unknown) => projectSchema.parse(p)) as Project[]

const roles = new Map<number, RoleDetail>(
  [3, 4, 5, 6]
    .map(id => roleDetailSchema.parse(leer(`roles_${id}.json`).role))
    .map(rol => [rol.id, rol]),
)

const rolPorNombre = (nombre: string) => [...roles.values()].find(r => r.name === nombre)!
const PORTAL_WEB = proyectos.find(p => p.identifier === 'portal-web')!.id

function mapaCon(nombreRol: string): ReturnType<typeof buildPermissionMap> {
  const rol = rolPorNombre(nombreRol)
  const comoUsuario: CurrentUser = {
    ...usuario,
    memberships: proyectos.map((p, i) => ({ id: i + 1, project: { id: p.id, name: p.name }, roles: [rol] })),
  }
  return buildPermissionMap(comoUsuario, roles, proyectos)
}

describe('permisos', () => {
  it('el desarrollador puede ver tareas y registrar tiempo', () => {
    const mapa = buildPermissionMap(usuario, roles, proyectos)
    expect(can(mapa, 'view_issues', PORTAL_WEB)).toBe(true)
    expect(can(mapa, 'log_time', PORTAL_WEB)).toBe(true)
    expect(can(mapa, 'add_issues', PORTAL_WEB)).toBe(true)
  })

  it('el cliente ve tareas pero no registra tiempo', () => {
    const mapa = mapaCon('Cliente')
    expect(can(mapa, 'view_issues', PORTAL_WEB)).toBe(true)
    expect(can(mapa, 'log_time', PORTAL_WEB)).toBe(false)
    expect(can(mapa, 'edit_issues', PORTAL_WEB)).toBe(false)
  })

  it('niega el permiso si el módulo está apagado, aunque el rol lo tenga', () => {
    const sinTiempo = proyectos.map(p => ({
      ...p,
      enabled_modules: p.enabled_modules?.filter(m => m.name !== 'time_tracking'),
    }))
    const mapa = buildPermissionMap(usuario, roles, sinTiempo)

    expect(can(mapa, 'log_time', PORTAL_WEB)).toBe(false)
    expect(can(mapa, 'view_issues', PORTAL_WEB)).toBe(true)
  })

  it('el administrador puede todo, sin membresías', () => {
    const admin: CurrentUser = { ...usuario, admin: true, memberships: [] }
    const mapa = buildPermissionMap(admin, new Map(), proyectos)

    expect(can(mapa, 'log_time', PORTAL_WEB)).toBe(true)
    expect(can(mapa, 'delete_issues', PORTAL_WEB)).toBe(true)
  })

  it('el administrador tampoco puede si el módulo está apagado', () => {
    const admin: CurrentUser = { ...usuario, admin: true, memberships: [] }
    const sinWiki = proyectos.map(p => ({
      ...p,
      enabled_modules: p.enabled_modules?.filter(m => m.name !== 'wiki'),
    }))
    expect(can(buildPermissionMap(admin, new Map(), sinWiki), 'view_wiki_pages', PORTAL_WEB)).toBe(false)
  })

  it('en un proyecto sin membresía no puede nada', () => {
    const mapa = buildPermissionMap({ ...usuario, memberships: [] }, roles, proyectos)
    expect(can(mapa, 'view_issues', PORTAL_WEB)).toBe(false)
  })

  it('el modo degradado permite y deja que Redmine decida', () => {
    const mapa = buildPermissionMap(usuario, new Map(), proyectos, { degraded: true })
    expect(mapa.degraded).toBe(true)
    expect(can(mapa, 'log_time', PORTAL_WEB)).toBe(true)
    // El módulo sigue mandando incluso en modo degradado.
    const sinTiempo = proyectos.map(p => ({
      ...p,
      enabled_modules: p.enabled_modules?.filter(m => m.name !== 'time_tracking'),
    }))
    expect(can(buildPermissionMap(usuario, new Map(), sinTiempo, { degraded: true }), 'log_time', PORTAL_WEB)).toBe(false)
  })

  it('sin proyecto, responde si puede en alguno', () => {
    const mapa = mapaCon('Cliente')
    expect(can(mapa, 'view_issues')).toBe(true)
    expect(can(mapa, 'log_time')).toBe(false)
  })

  it('lista los proyectos donde puede crear tareas', () => {
    expect(projectsWith(buildPermissionMap(usuario, roles, proyectos), 'add_issues', proyectos))
      .toHaveLength(proyectos.length)
    expect(projectsWith(mapaCon('Cliente'), 'edit_issues', proyectos)).toHaveLength(0)
  })
})
