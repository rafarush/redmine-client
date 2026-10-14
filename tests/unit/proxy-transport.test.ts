// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ProxyTransport } from '../../shared/redmine/proxy-transport'
import type { RedmineError } from '../../shared/redmine/transport'
import { BASE_PROXY, servidorRedmine } from '../mocks/redmine'
import { pruebaDeContrato } from './transport-contract'

beforeAll(() => servidorRedmine.listen({ onUnhandledRequest: 'error' }))
afterEach(() => servidorRedmine.resetHandlers())
afterAll(() => servidorRedmine.close())

const crear = () => new ProxyTransport(globalThis.fetch, BASE_PROXY)

pruebaDeContrato('ProxyTransport', crear)

describe('ProxyTransport', () => {
  it('no deja que la clave de API llegue al navegador', async () => {
    const respuesta = await crear().request<{ user: Record<string, unknown> }>({
      path: '/users/current.json',
      query: { include: 'memberships,groups' },
    })

    expect(respuesta.user).not.toHaveProperty('api_key')
    expect(JSON.stringify(respuesta)).not.toContain('api_key')
  })

  it('manda la cabecera anti-CSRF al escribir', async () => {
    // El mock responde 403 si falta; que no sea 403 prueba que va puesta.
    const error = await crear()
      .request({ method: 'POST', path: '/issues.json', body: { issue: {} } })
      .catch(e => e as RedmineError)

    expect(error.status).toBe(422)
  })

  it('crea una tarea cuando los datos son válidos', async () => {
    const respuesta = await crear().request<{ issue: { id: number } }>({
      method: 'POST',
      path: '/issues.json',
      body: { issue: { project_id: 1, subject: 'Probar el proxy' } },
    })
    expect(respuesta.issue.id).toBe(999)
  })

  it('se identifica como transport de proxy', () => {
    expect(crear().kind).toBe('proxy')
  })
})
