// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { newsExcerpt, unseenCount } from '../../shared/redmine/news'

describe('novedades', () => {
  const news = [{ created_on: '2026-10-15T10:00:00Z' }, { created_on: '2026-10-10T10:00:00Z' }]

  it('cuenta las publicadas desde la última visita', () => {
    expect(unseenCount(news, '2026-10-12T00:00:00Z')).toBe(1)
    expect(unseenCount(news, '2026-10-16T00:00:00Z')).toBe(0)
  })

  it('la primera vez no avisa', () => {
    expect(unseenCount(news, null)).toBe(0)
  })

  it('resume con el sumario o el principio del texto', () => {
    expect(newsExcerpt({ summary: 'Corto', description: 'Largo' })).toBe('Corto')
    expect(newsExcerpt({ summary: '', description: 'a\n\nb' })).toBe('a b')
    expect(newsExcerpt({ description: 'x'.repeat(300) }, 10)).toBe(`${'x'.repeat(9)}…`)
  })
})
