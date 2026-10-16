// @vitest-environment node
import type { Project, Version } from '../../shared/redmine/types'
import { describe, expect, it } from 'vitest'
import { fromUrl } from '../../shared/redmine/filters'
import {
  buildProjectTree,
  countDescendants,
  describeDaysLeft,
  filterProjectTree,
  issuesLink,
  nextVersion,
  sanitizePinned,
  togglePinned,
  versionProgress,
} from '../../shared/redmine/projects'

function project(id: number, name: string, parent?: number, status = 1): Project {
  return { id, name, identifier: name.toLowerCase().replace(/\s/g, '-'), status, parent: parent ? { id: parent, name: '' } : undefined }
}

function version(id: number, due: string | null, status: Version['status'] = 'open'): Version {
  return { id, name: `v${id}`, status, due_date: due }
}

describe('árbol de proyectos', () => {
  const projects = [
    project(1, 'Portal web'),
    project(2, 'App móvil'),
    project(3, 'Gestión de pagos', 1),
    project(4, 'Archivo viejo', 1, 9),
    project(5, 'Pasarela', 3),
    project(6, 'Huérfano', 99),
  ]

  it('anida por padre, ordena por nombre y quita los archivados', () => {
    const tree = buildProjectTree(projects)
    expect(tree.map(n => n.project.name)).toEqual(['App móvil', 'Huérfano', 'Portal web'])
    const portal = tree[2]!
    expect(portal.children.map(n => n.project.name)).toEqual(['Gestión de pagos'])
    expect(portal.children[0]!.children[0]!.project.name).toBe('Pasarela')
    expect(countDescendants(portal)).toBe(2)
  })

  it('busca sin acentos y conserva los antecesores', () => {
    const tree = filterProjectTree(buildProjectTree(projects), 'gestion')
    expect(tree).toHaveLength(1)
    expect(tree[0]!.project.name).toBe('Portal web')
    expect(tree[0]!.children[0]!.project.name).toBe('Gestión de pagos')
    // Del que coincide se ven también sus hijos.
    expect(tree[0]!.children[0]!.children).toHaveLength(1)
    expect(filterProjectTree(buildProjectTree(projects), 'nada')).toEqual([])
  })
})

describe('fijados', () => {
  it('limpia lo guardado y alterna', () => {
    expect(sanitizePinned([1, 1, 'x', -2, 3])).toEqual([1, 3])
    expect(sanitizePinned(null)).toEqual([])
    expect(togglePinned([1, 3], 3)).toEqual([1])
    expect(togglePinned([1], 4)).toEqual([1, 4])
  })
})

describe('versiones', () => {
  it('la próxima es la abierta más cercana que no ha pasado', () => {
    const versions = [version(1, '2026-09-01'), version(2, '2026-11-01'), version(3, '2026-10-20'), version(4, null), version(5, '2026-10-16', 'closed')]
    expect(nextVersion(versions, '2026-10-15')?.id).toBe(3)
    expect(nextVersion([version(1, '2026-09-01')], '2026-10-15')?.id).toBe(1)
    expect(nextVersion([], '2026-10-15')).toBeUndefined()
  })

  it('dice los días que quedan', () => {
    expect(describeDaysLeft('2026-10-15', '2026-10-15')).toBe('Vence hoy')
    expect(describeDaysLeft('2026-10-16', '2026-10-15')).toBe('Queda 1 día')
    expect(describeDaysLeft('2026-10-25', '2026-10-15')).toBe('Quedan 10 días')
    expect(describeDaysLeft('2026-10-10', '2026-10-15')).toBe('Venció hace 5 días')
    expect(describeDaysLeft(null, '2026-10-15')).toBe('Sin fecha')
  })

  it('calcula el avance como Redmine', () => {
    expect(versionProgress([]).percent).toBe(0)
    expect(versionProgress([{ closed: true, done_ratio: 0 }]).percent).toBe(100)
    // Sin estimaciones: media simple de done_ratio, cerradas al 100.
    const plain = versionProgress([{ closed: true, done_ratio: 0 }, { closed: false, done_ratio: 50 }, { closed: false, done_ratio: 0 }, { closed: false, done_ratio: 0 }])
    expect(plain.percent).toBe(37.5)
    expect(plain.label).toBe('1 de 4 · 37 %')
    // Con estimaciones: pesa cada una; la que no tiene usa la media (4 h).
    const weighted = versionProgress([
      { closed: true, done_ratio: 0, estimated_hours: 6 },
      { closed: false, done_ratio: 50, estimated_hours: 2 },
      { closed: false, done_ratio: 0 },
    ])
    expect(weighted.percent).toBeCloseTo((6 * 100 + 2 * 50) / (4 * 3))
  })
})

describe('enlaces a la lista', () => {
  it('lleva la frase en ?f=', () => {
    const link = issuesLink([{ field: 'project_id', operator: '=', values: ['3'] }, { field: 'status_id', operator: '=', values: ['open'] }])
    expect(link.path).toBe('/issues')
    expect(fromUrl(link.query.f).conditions).toHaveLength(2)
  })
})
