// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ProxyTransport } from '../../shared/redmine/proxy-transport'
import type { RedmineError } from '../../shared/redmine/transport'
import { PROXY_BASE, redmineServer } from '../mocks/redmine'
import { transportContractSuite } from './transport-contract'

beforeAll(() => redmineServer.listen({ onUnhandledRequest: 'error' }))
afterEach(() => redmineServer.resetHandlers())
afterAll(() => redmineServer.close())

const create = () => new ProxyTransport(globalThis.fetch, PROXY_BASE)

transportContractSuite('ProxyTransport', create)

describe('ProxyTransport', () => {
  it('no deja que la clave de API llegue al navegador', async () => {
    const response = await create().request<{ user: Record<string, unknown> }>({
      path: '/users/current.json',
      query: { include: 'memberships,groups' },
    })

    expect(response.user).not.toHaveProperty('api_key')
    expect(JSON.stringify(response)).not.toContain('api_key')
  })

  it('manda la cabecera anti-CSRF al escribir', async () => {
    // El mock responde 403 si falta; que no sea 403 prueba que va puesta.
    const error = await create()
      .request({ method: 'POST', path: '/issues.json', body: { issue: {} } })
      .catch(e => e as RedmineError)

    expect(error.status).toBe(422)
  })

  it('crea una tarea cuando los datos son válidos', async () => {
    const response = await create().request<{ issue: { id: number } }>({
      method: 'POST',
      path: '/issues.json',
      body: { issue: { project_id: 1, subject: 'Probar el proxy' } },
    })
    expect(response.issue.id).toBe(999)
  })

  it('se identifica como transport de proxy', () => {
    expect(create().kind).toBe('proxy')
  })
})
