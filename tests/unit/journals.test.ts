// @vitest-environment node
import type { Journal } from '../../shared/redmine/types'
import { describe, expect, it } from 'vitest'
import { buildTimeline, describeDetail } from '../../shared/redmine/journals'

const statuses: Record<string, string> = { 1: 'Nueva', 2: 'En curso' }
const lookup = (field: string, id: string) => field === 'status_id' ? statuses[id] : undefined

describe('cambios de campo', () => {
  it('resume un cambio con nombres', () => {
    expect(describeDetail({ property: 'attr', name: 'status_id', old_value: '1', new_value: '2' }, lookup).text)
      .toBe('Estado: Nueva → En curso')
  })

  it('valor nuevo, quitado y campos especiales', () => {
    expect(describeDetail({ property: 'attr', name: 'due_date', old_value: null, new_value: '2026-10-20' }).text).toBe('Vence: 2026-10-20')
    expect(describeDetail({ property: 'attr', name: 'assigned_to_id', old_value: '5', new_value: null }).text).toBe('Asignada a: quitado (5)')
    expect(describeDetail({ property: 'attr', name: 'done_ratio', old_value: '0', new_value: '50' }).text).toBe('Hecho: 0 % → 50 %')
    expect(describeDetail({ property: 'attr', name: 'description', old_value: 'a', new_value: 'b' }).text).toBe('Descripción actualizada')
  })

  it('campos personalizados, adjuntos y relaciones', () => {
    expect(describeDetail({ property: 'cf', name: '3', old_value: 'A', new_value: 'B' }, undefined, new Map([[3, 'Cliente']])).text).toBe('Cliente: A → B')
    expect(describeDetail({ property: 'attachment', name: '9', old_value: null, new_value: 'captura.png' }).text).toBe('Adjunto añadido: captura.png')
    expect(describeDetail({ property: 'relation', name: 'blocks', old_value: null, new_value: '12' }).text).toBe('Relación añadida: blocks #12')
  })
})

describe('línea de tiempo', () => {
  it('ordena y quita journals vacíos', () => {
    const journals: Journal[] = [
      { id: 3, user: { id: 1, name: 'Ana' }, notes: 'Hecho', created_on: '2026-10-15T10:00:00Z', details: [] },
      { id: 1, user: { id: 1, name: 'Ana' }, notes: '', created_on: '2026-10-14T10:00:00Z', details: [{ property: 'attr', name: 'status_id', old_value: '1', new_value: '2' }] },
      { id: 2, notes: '  ', created_on: '2026-10-14T11:00:00Z', details: [] },
    ]
    const items = buildTimeline(journals, lookup)
    expect(items.map(i => i.id)).toEqual([1, 3])
    expect(items[0]!.changes[0]!.text).toBe('Estado: Nueva → En curso')
    expect(items[1]!.notes).toBe('Hecho')
  })
})
