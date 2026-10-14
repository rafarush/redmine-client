import type { RedmineTransport } from '../../shared/redmine/transport'
import { describe, expect, it } from 'vitest'
import { RedmineError } from '../../shared/redmine/transport'

/**
 * Contrato que cumplen todos los transports (F1-T03).
 * ProxyTransport lo pasa ahora; TauriTransport tendrá que pasarlo en F8-T04.
 */
export function transportContractSuite(
  name: string,
  create: () => RedmineTransport,
  /** Ruta que el backend de prueba responde con 404. */
  missingPath = '/noexiste.json',
) {
  describe(`contrato de transport: ${name}`, () => {
    it('hace GET y devuelve el JSON', async () => {
      const response = await create().request<{ user: { login: string } }>({
        path: '/users/current.json',
        query: { include: 'memberships,groups' },
      })
      expect(response.user.login).toBe('desarrollador')
    })

    it('pasa los parámetros de consulta', async () => {
      const response = await create().request<{ total_count: number }>({
        path: '/issues.json',
        query: { status_id: '*', limit: 25 },
      })
      expect(response.total_count).toBeGreaterThan(0)
    })

    it('lanza RedmineError con el status cuando falla', async () => {
      await expect(create().request({ path: missingPath }))
        .rejects.toBeInstanceOf(RedmineError)

      const error = await create().request({ path: missingPath }).catch(e => e as RedmineError)
      expect(error.status).toBeGreaterThanOrEqual(400)
    })

    it('expone los mensajes de validación de Redmine', async () => {
      const error = await create()
        .request({ method: 'POST', path: '/issues.json', body: { issue: {} } })
        .catch(e => e as RedmineError)

      expect(error).toBeInstanceOf(RedmineError)
      expect(error.status).toBe(422)
      expect(error.errors.length).toBeGreaterThan(0)
      expect(error.message).toBe(error.errors[0])
    })
  })
}
