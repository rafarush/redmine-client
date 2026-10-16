// @vitest-environment node
import type { ProjectMember } from '../../shared/redmine/types'
import { describe, expect, it } from 'vitest'
import { countByRole, groupMembers } from '../../shared/redmine/members'

const memberships: ProjectMember[] = [
  { id: 1, user: { id: 5, name: 'Dani Desarrollo' }, roles: [{ id: 4, name: 'Desarrollador' }] },
  { id: 2, user: { id: 6, name: 'Carmen Cliente' }, roles: [{ id: 6, name: 'Cliente' }] },
  { id: 3, group: { id: 9, name: 'QA' }, roles: [{ id: 5, name: 'Tester' }] },
  // Rol heredado del grupo, repetido en otra membresía de la misma persona.
  { id: 4, user: { id: 5, name: 'Dani Desarrollo' }, roles: [{ id: 4, name: 'Desarrollador', inherited: true }, { id: 5, name: 'Tester' }] },
]

describe('miembros', () => {
  it('separa personas y grupos y junta roles sin duplicar', () => {
    const { people, groups } = groupMembers(memberships)
    expect(people.map(p => p.name)).toEqual(['Carmen Cliente', 'Dani Desarrollo'])
    expect(people[1]!.roles).toEqual(['Desarrollador', 'Tester'])
    expect(groups).toEqual([{ kind: 'group', id: 9, name: 'QA', roles: ['Tester'] }])
  })

  it('cuenta por rol', () => {
    const { people } = groupMembers(memberships)
    expect(countByRole(people)).toEqual([{ role: 'Cliente', count: 1 }, { role: 'Desarrollador', count: 1 }, { role: 'Tester', count: 1 }])
  })
})
