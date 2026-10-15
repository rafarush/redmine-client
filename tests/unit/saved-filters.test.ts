import { describe, expect, it } from 'vitest'
import { cleanName, removeFilter, sanitizeSaved, saveFilter } from '../../shared/redmine/saved-filters'

let n = 0
const id = () => `id${++n}`

describe('filtros guardados', () => {
  it('guarda con nombre limpio', () => {
    const list = saveFilter([], '  Mis   urgentes ', 'priority_id:%3D:5', id)
    expect(list).toEqual([{ id: expect.any(String), name: 'Mis urgentes', f: 'priority_id:%3D:5' }])
  })

  it('un nombre repetido reemplaza la frase, sin duplicar', () => {
    const first = saveFilter([], 'Urgentes', 'a', id)
    const second = saveFilter(first, 'urgentes', 'b', id)
    expect(second).toHaveLength(1)
    expect(second[0]).toMatchObject({ id: first[0]!.id, name: 'urgentes', f: 'b' })
  })

  it('ignora nombre vacío o frase vacía', () => {
    expect(saveFilter([], '   ', 'a', id)).toEqual([])
    expect(saveFilter([], 'x', '', id)).toEqual([])
  })

  it('recorta nombres largos', () => {
    expect(cleanName('x'.repeat(200))).toHaveLength(60)
  })

  it('elimina por id', () => {
    const list = saveFilter(saveFilter([], 'A', 'a', id), 'B', 'b', id)
    expect(removeFilter(list, list[0]!.id).map(i => i.name)).toEqual(['B'])
  })

  it('sanea lo leído de localStorage', () => {
    expect(sanitizeSaved(null)).toEqual([])
    expect(sanitizeSaved('x')).toEqual([])
    expect(sanitizeSaved([
      { id: '1', name: 'Ok', f: 'a' },
      { id: '1', name: 'Repetido', f: 'a' },
      { id: 2, name: 'Sin id string', f: 'a' },
      { id: '3', name: '', f: 'a' },
      null,
    ])).toEqual([{ id: '1', name: 'Ok', f: 'a' }])
  })
})
