// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { API_KEY_VALIDA, BASE_REDMINE, servidorRedmine } from '../mocks/redmine'

/**
 * Comprueba que los tests pueden hablar con un Redmine de mentira sin Docker (F0-T07).
 * Las fixtures vienen de `pnpm capture:fixtures` contra el Redmine local.
 */
beforeAll(() => servidorRedmine.listen({ onUnhandledRequest: 'error' }))
afterEach(() => servidorRedmine.resetHandlers())
afterAll(() => servidorRedmine.close())

function pedir(ruta: string, apiKey = API_KEY_VALIDA) {
  return fetch(`${BASE_REDMINE}${ruta}`, { headers: { 'X-Redmine-API-Key': apiKey } })
}

describe('mock de Redmine', () => {
  it('devuelve el usuario actual con sus membresías', async () => {
    const respuesta = await pedir('/users/current.json?include=memberships,groups')
    expect(respuesta.status).toBe(200)

    const { user } = await respuesta.json()
    expect(user.login).toBe('desarrollador')
    expect(user.admin).toBeFalsy()
    expect(user.memberships).toHaveLength(3)
    expect(user.memberships[0].roles[0].name).toBe('Desarrollador')
  })

  it('devuelve los permisos de cada rol', async () => {
    const { roles } = await (await pedir('/roles.json')).json()
    const cliente = roles.find((rol: { name: string }) => rol.name === 'Cliente')
    const desarrollador = roles.find((rol: { name: string }) => rol.name === 'Desarrollador')

    const permisosCliente = (await (await pedir(`/roles/${cliente.id}.json`)).json()).role.permissions
    const permisosDesarrollador = (await (await pedir(`/roles/${desarrollador.id}.json`)).json()).role.permissions

    // El caso que la app tiene que respetar: ver tareas sí, registrar tiempo no.
    expect(permisosCliente).toContain('view_issues')
    expect(permisosCliente).not.toContain('log_time')
    expect(permisosDesarrollador).toContain('log_time')
  })

  it('devuelve tareas y entradas de tiempo', async () => {
    const { issues, total_count: totalTareas } = await (await pedir('/issues.json?status_id=*&limit=25')).json()
    expect(totalTareas).toBeGreaterThanOrEqual(40)
    expect(issues[0]).toHaveProperty('subject')

    const { time_entries: tiempos } = await (await pedir('/time_entries.json?user_id=me&limit=25')).json()
    expect(tiempos.length).toBeGreaterThan(0)
    expect(tiempos[0].user.name).toContain('Dani')
  })

  it('no le importa el orden de los parámetros', async () => {
    const respuesta = await pedir('/issues.json?limit=25&status_id=*')
    expect(respuesta.status).toBe(200)
  })

  it('responde 401 con una clave que no vale', async () => {
    const respuesta = await pedir('/users/current.json', '0'.repeat(40))
    expect(respuesta.status).toBe(401)
  })

  it('avisa con claridad cuando falta una fixture', async () => {
    const respuesta = await pedir('/noexiste.json')
    expect(respuesta.status).toBe(501)

    const { errors } = await respuesta.json()
    expect(errors[0]).toMatch(/capture-fixtures/)
  })
})
