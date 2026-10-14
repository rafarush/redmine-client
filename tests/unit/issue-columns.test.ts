// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { DEFAULT_VISIBLE_COLUMNS, sanitizeColumns, toggleColumn } from '../../shared/redmine/issue-columns'

describe('toggleColumn', () => {
  it('oculta y vuelve a mostrar en orden canónico', () => {
    const hidden = toggleColumn(DEFAULT_VISIBLE_COLUMNS, 'priority')
    expect(hidden).not.toContain('priority')
    expect(toggleColumn(hidden, 'priority')).toEqual([...DEFAULT_VISIBLE_COLUMNS])
  })

  it('no oculta # ni Asunto', () => {
    expect(toggleColumn(DEFAULT_VISIBLE_COLUMNS, 'subject')).toContain('subject')
  })
})

describe('sanitizeColumns', () => {
  it('descarta ids desconocidos y repone las obligatorias', () => {
    expect(sanitizeColumns(['status', 'zzz'])).toEqual(['id', 'subject', 'status'])
  })

  it('usa los de fábrica con basura', () => {
    expect(sanitizeColumns('x')).toEqual([...DEFAULT_VISIBLE_COLUMNS])
  })
})
