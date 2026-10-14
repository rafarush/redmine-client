// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { REDMINE_BASE, redmineServer, VALID_API_KEY } from '../mocks/redmine'

/**
 * Comprueba que los tests pueden hablar con un Redmine de mentira sin Docker (F0-T07).
 * Las fixtures vienen de `pnpm capture:fixtures` contra el Redmine local.
 */
beforeAll(() => redmineServer.listen({ onUnhandledRequest: 'error' }))
afterEach(() => redmineServer.resetHandlers())
afterAll(() => redmineServer.close())

function request(path: string, apiKey = VALID_API_KEY) {
  return fetch(`${REDMINE_BASE}${path}`, { headers: { 'X-Redmine-API-Key': apiKey } })
}

describe('mock de Redmine', () => {
  it('devuelve el usuario actual con sus membresías', async () => {
    const response = await request('/users/current.json?include=memberships,groups')
    expect(response.status).toBe(200)

    const { user } = await response.json()
    expect(user.login).toBe('desarrollador')
    expect(user.admin).toBeFalsy()
    expect(user.memberships).toHaveLength(3)
    expect(user.memberships[0].roles[0].name).toBe('Desarrollador')
  })

  it('devuelve los permisos de cada rol', async () => {
    const { roles } = await (await request('/roles.json')).json()
    const clientRole = roles.find((role: { name: string }) => role.name === 'Cliente')
    const developerRole = roles.find((role: { name: string }) => role.name === 'Desarrollador')

    const clientPermissions = (await (await request(`/roles/${clientRole.id}.json`)).json()).role.permissions
    const developerPermissions = (await (await request(`/roles/${developerRole.id}.json`)).json()).role.permissions

    // El caso que la app tiene que respetar: ver tareas sí, registrar tiempo no.
    expect(clientPermissions).toContain('view_issues')
    expect(clientPermissions).not.toContain('log_time')
    expect(developerPermissions).toContain('log_time')
  })

  it('devuelve tareas y entradas de tiempo', async () => {
    const { issues, total_count: issueCount } = await (await request('/issues.json?status_id=*&limit=25')).json()
    expect(issueCount).toBeGreaterThanOrEqual(40)
    expect(issues[0]).toHaveProperty('subject')

    const { time_entries: timeEntries } = await (await request('/time_entries.json?user_id=me&limit=25')).json()
    expect(timeEntries.length).toBeGreaterThan(0)
    expect(timeEntries[0].user.name).toContain('Dani')
  })

  it('no le importa el orden de los parámetros', async () => {
    const response = await request('/issues.json?limit=25&status_id=*')
    expect(response.status).toBe(200)
  })

  it('responde 401 con una clave que no vale', async () => {
    const response = await request('/users/current.json', '0'.repeat(40))
    expect(response.status).toBe(401)
  })

  it('avisa con claridad cuando falta una fixture', async () => {
    const response = await request('/noexiste.json')
    expect(response.status).toBe(501)

    const { errors } = await response.json()
    expect(errors[0]).toMatch(/capture-fixtures/)
  })
})
