// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { describeRelation, issueExtras, parseIssueSearch } from '../../shared/redmine/relations'

describe('relaciones', () => {
  it('se leen desde la tarea abierta', () => {
    const blocks = { id: 1, issue_id: 10, issue_to_id: 20, relation_type: 'blocks' }
    expect(describeRelation(blocks, 10)).toEqual({ otherId: 20, label: 'Bloquea a' })
    expect(describeRelation(blocks, 20)).toEqual({ otherId: 10, label: 'Bloqueada por' })
  })

  it('incluyen el retraso y toleran tipos desconocidos', () => {
    expect(describeRelation({ id: 2, issue_id: 1, issue_to_id: 2, relation_type: 'precedes', delay: 2 }, 2).label).toBe('Sigue a (2 días)')
    expect(describeRelation({ id: 3, issue_id: 1, issue_to_id: 2, relation_type: 'plugin_type' }, 1).label).toBe('plugin_type')
  })

  it('lee relaciones, hijas y observadores de la tarea', () => {
    const extras = issueExtras({
      id: 1,
      relations: [{ id: 1, issue_id: 1, issue_to_id: 2, relation_type: 'relates' }],
      children: [{ id: 5, subject: 'Hija', children: [{ id: 6, subject: 'Nieta' }] }],
      watchers: [{ id: 3, name: 'Ana' }],
    })
    expect(extras.relations).toHaveLength(1)
    expect(extras.children[0]!.children![0]!.subject).toBe('Nieta')
    expect(extras.watchers[0]!.name).toBe('Ana')
    expect(issueExtras({ id: 1 })).toEqual({ relations: [], children: [], watchers: [] })
  })
})

describe('buscar tarea', () => {
  it('número o texto', () => {
    expect(parseIssueSearch('#123')).toEqual({ id: 123 })
    expect(parseIssueSearch(' 45 ')).toEqual({ id: 45 })
    expect(parseIssueSearch('login roto')).toEqual({ subject: 'login roto' })
    expect(parseIssueSearch('  ')).toBeNull()
  })
})
