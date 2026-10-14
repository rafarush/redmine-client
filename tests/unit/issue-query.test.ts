// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { clampPage, issuesQueryKey, pageCount, toIssuesQuery } from '../../shared/redmine/issue-query'

const sentence = { conditions: [{ field: 'status_id' as const, operator: '=' as const, values: ['open'] }] }

describe('toIssuesQuery', () => {
  it('pone límite, offset y orden por defecto', () => {
    expect(toIssuesQuery({ sentence: { conditions: [] } })).toMatchObject({ limit: 100, offset: 0, sort: 'updated_on:desc' })
  })

  it('calcula el offset por página', () => {
    expect(toIssuesQuery({ sentence: { conditions: [] }, page: 3 }).offset).toBe(300)
  })

  it('respeta el orden pedido', () => {
    expect(toIssuesQuery({ sentence: { conditions: [] }, sort: { field: 'id', direction: 'asc' } }).sort).toBe('id:asc')
  })
})

describe('issuesQueryKey', () => {
  it('es igual para la misma consulta y distinta si cambia la página', () => {
    expect(issuesQueryKey({ sentence })).toEqual(issuesQueryKey({ sentence }))
    expect(issuesQueryKey({ sentence })).not.toEqual(issuesQueryKey({ sentence, page: 1 }))
  })
})

describe('paginación', () => {
  it('cuenta páginas y acota la actual', () => {
    expect(pageCount(0)).toBe(1)
    expect(pageCount(201)).toBe(3)
    expect(clampPage(9, 150)).toBe(1)
    expect(clampPage(-2, 150)).toBe(0)
  })
})
