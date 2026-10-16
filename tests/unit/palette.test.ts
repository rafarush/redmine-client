import { describe, expect, it } from 'vitest'
import { addRecent, filterByName, filterCommands, MAX_RECENT, parseSearch, sanitizeRecent } from '../../shared/redmine/palette'

describe('parseSearch', () => {
  it('reconoce #id y número suelto', () => {
    expect(parseSearch('#4821')).toEqual({ kind: 'issue-id', id: 4821 })
    expect(parseSearch(' 12 ')).toEqual({ kind: 'issue-id', id: 12 })
  })
  it('texto y vacío', () => {
    expect(parseSearch('   ')).toEqual({ kind: 'empty' })
    expect(parseSearch('login  roto')).toEqual({ kind: 'text', text: 'login roto' })
    expect(parseSearch('#0')).toEqual({ kind: 'text', text: '#0' })
    expect(parseSearch('#12 login')).toEqual({ kind: 'text', text: '#12 login' })
  })
})

describe('filtrado', () => {
  it('comandos sin acentos ni mayúsculas, por etiqueta o palabra clave', () => {
    expect(filterCommands('TIEMPO').map(c => c.id)).toEqual(['go-time'])
    expect(filterCommands('horas').map(c => c.id)).toEqual(['go-time'])
    expect(filterCommands('')).toHaveLength(5)
  })
  it('proyectos por nombre, con tope y sin consulta vacía', () => {
    const projects = [{ name: 'Ingeniería' }, { name: 'Ingreso de datos' }, { name: 'Web' }]
    expect(filterByName(projects, 'ingenieria', 5)).toEqual([{ name: 'Ingeniería' }])
    expect(filterByName(projects, 'ing', 1)).toHaveLength(1)
    expect(filterByName(projects, '', 5)).toEqual([])
  })
})

describe('recientes', () => {
  it('la última primero, sin repetir y con tope', () => {
    expect(addRecent(['a', 'b'], 'B')).toEqual(['B', 'a'])
    let list: string[] = []
    for (let i = 0; i < 10; i++) list = addRecent(list, `q${i}`)
    expect(list).toHaveLength(MAX_RECENT)
    expect(list[0]).toBe('q9')
  })
  it('sanea lo leído', () => {
    expect(sanitizeRecent(['a', 1, 'A', ' b ', ''])).toEqual(['a', 'b'])
    expect(sanitizeRecent('x')).toEqual([])
  })
})
