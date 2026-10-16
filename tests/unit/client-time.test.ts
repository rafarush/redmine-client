// @vitest-environment node
import type { RedmineRequest, RedmineTransport } from '../../shared/redmine/transport'
import { describe, expect, it } from 'vitest'
import { RedmineClient } from '../../shared/redmine/client'

/** Transport que solo apunta lo que se le pide. */
function recorder(response: unknown = undefined): { transport: RedmineTransport, calls: RedmineRequest[] } {
  const calls: RedmineRequest[] = []
  return {
    calls,
    transport: {
      kind: 'proxy',
      request: async <T>(req: RedmineRequest) => {
        calls.push(req)
        return response as T
      },
    },
  }
}

describe('cliente: tiempo', () => {
  it('ajusta un registro con PUT /time_entries/:id.json', async () => {
    const { transport, calls } = recorder()
    await new RedmineClient(transport).updateTimeEntry(42, { hours: 1.25 })
    expect(calls).toEqual([{ method: 'PUT', path: '/time_entries/42.json', body: { time_entry: { hours: 1.25 } } }])
  })

  it('crea un registro y devuelve el creado', async () => {
    const created = {
      id: 7,
      project: { id: 1, name: 'Portal' },
      issue: { id: 4821 },
      user: { id: 3, name: 'Dani' },
      activity: { id: 9, name: 'Desarrollo' },
      hours: 0.5,
      spent_on: '2026-10-15',
      created_on: '2026-10-15T10:00:00Z',
      updated_on: '2026-10-15T10:00:00Z',
    }
    const { transport, calls } = recorder({ time_entry: created })
    const entry = await new RedmineClient(transport).createTimeEntry({ issue_id: 4821, hours: 0.5 })
    expect(entry.id).toBe(7)
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/time_entries.json' })
  })
})
