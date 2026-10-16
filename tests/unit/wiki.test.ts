// @vitest-environment node
import type { WikiPageRef } from '../../shared/redmine/types'
import { describe, expect, it } from 'vitest'
import { buildWikiTree, filterWikiTree, lineDiff, resolveWikiLinks, startPage, wikiLabel, wikiTitle } from '../../shared/redmine/wiki'

const pages: WikiPageRef[] = [
  { title: 'Wiki' },
  { title: 'Guía_de_estilo', parent: { title: 'Wiki' } },
  { title: 'Despliegue', parent: { title: 'Wiki' } },
  { title: 'Producción', parent: { title: 'Despliegue' } },
  { title: 'Suelta', parent: { title: 'No_existe' } },
]

describe('títulos', () => {
  it('como los guarda Redmine', () => {
    expect(wikiTitle('guía de estilo')).toBe('Guía_de_estilo')
    expect(wikiTitle('¿Qué? hacer, ya.')).toBe('¿Qué_hacer_ya')
    expect(wikiLabel('Guía_de_estilo')).toBe('Guía de estilo')
  })
})

describe('índice', () => {
  it('anida por padre y sube los huérfanos', () => {
    const tree = buildWikiTree(pages)
    expect(tree.map(n => n.page.title)).toEqual(['Suelta', 'Wiki'])
    expect(tree[1]!.children.map(n => n.page.title)).toEqual(['Despliegue', 'Guía_de_estilo'])
    expect(tree[1]!.children[0]!.children[0]!.page.title).toBe('Producción')
  })

  it('busca sin acentos conservando el camino', () => {
    const found = filterWikiTree(buildWikiTree(pages), 'produccion')
    expect(found).toHaveLength(1)
    expect(found[0]!.children[0]!.children[0]!.page.title).toBe('Producción')
  })

  it('elige la página de inicio', () => {
    expect(startPage(pages)).toBe('Wiki')
    expect(startPage([{ title: 'Beta' }, { title: 'Alfa' }])).toBe('Alfa')
    expect(startPage([])).toBeUndefined()
  })
})

describe('enlaces internos', () => {
  it('en textile y markdown', () => {
    expect(resolveWikiLinks('Ver [[Guía de estilo]].', 'portal-web', 'textile'))
      .toBe('Ver "Guía de estilo":/projects/portal-web/wiki/Gu%C3%ADa_de_estilo.')
    expect(resolveWikiLinks('[[Despliegue|cómo desplegar]]', 'portal-web', 'markdown'))
      .toBe('[cómo desplegar](/projects/portal-web/wiki/Despliegue)')
  })

  it('con ancla y de otro proyecto', () => {
    expect(resolveWikiLinks('[[Despliegue#pasos]]', 'p', 'markdown')).toBe('[Despliegue#pasos](/projects/p/wiki/Despliegue#pasos)')
    expect(resolveWikiLinks('[[app-movil:Inicio]]', 'p', 'markdown')).toBe('[Inicio](/projects/app-movil/wiki/Inicio)')
  })

  it('no toca los bloques de código', () => {
    const text = '```\n[[Nada]]\n```\n[[Algo]]'
    expect(resolveWikiLinks(text, 'p', 'markdown')).toBe('```\n[[Nada]]\n```\n[Algo](/projects/p/wiki/Algo)')
  })
})

describe('diferencias', () => {
  it('marca lo que cambió por líneas', () => {
    expect(lineDiff('a\nb\nc', 'a\nB\nc\nd')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'del', text: 'b' },
      { kind: 'add', text: 'B' },
      { kind: 'same', text: 'c' },
      { kind: 'add', text: 'd' },
    ])
  })
})
