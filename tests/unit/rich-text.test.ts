// @vitest-environment jsdom
// jsdom y no happy-dom: happy-dom serializa mal el contenido de <template>.
import { describe, expect, it } from 'vitest'
import { applyMarkup, detectFormat, renderRichText, resolveFormat } from '../../shared/redmine/rich-text'

describe('detección del formato', () => {
  it('reconoce markdown', () => {
    expect(detectFormat('# Título\n\nTexto con **negrita** y [enlace](https://x.es)')).toBe('markdown')
    expect(detectFormat('```\ncódigo\n```')).toBe('markdown')
  })

  it('reconoce textile y lo toma por defecto', () => {
    expect(detectFormat('h2. Título\n\n"enlace":https://x.es')).toBe('textile')
    expect(detectFormat('texto llano')).toBe('textile')
    expect(detectFormat('# uno\n# dos')).toBe('textile')
  })

  it('respeta la preferencia manual', () => {
    expect(resolveFormat('h2. Título', 'markdown')).toBe('markdown')
    expect(resolveFormat('h2. Título', 'auto')).toBe('textile')
  })
})

describe('render saneado', () => {
  it('no deja pasar scripts ni manejadores', () => {
    for (const format of ['markdown', 'textile'] as const) {
      const html = renderRichText('<script>alert(1)</script><img src=x onerror="alert(1)">hola', format)
      expect(html).not.toContain('<script')
      expect(html).not.toMatch(/<img[^>]*onerror/)
    }
  })

  it('pinta el formato', () => {
    expect(renderRichText('**negrita**', 'markdown')).toContain('<strong>negrita</strong>')
    expect(renderRichText('h2. Título', 'textile')).toContain('<h2>Título</h2>')
  })

  it('enlaza #123 dentro de la app, pero no en código', () => {
    const html = renderRichText('Ver #123 y `#456`', 'markdown')
    expect(html).toContain('<a href="/issues/123" data-issue="123">#123</a>')
    expect(html).toContain('<code>#456</code>')
  })

  it('abre los enlaces externos en otra pestaña y deja dentro las rutas de la app', () => {
    expect(renderRichText('[web](https://x.es)', 'markdown')).toContain('target="_blank"')
    const internal = renderRichText('[guía](/projects/p/wiki/Guia)', 'markdown')
    expect(internal).toContain('data-internal')
    expect(internal).not.toContain('target=')
  })
})

describe('atajos del editor', () => {
  it('envuelve la selección según el formato', () => {
    expect(applyMarkup('hola mundo', 5, 10, 'bold', 'markdown')).toEqual({ text: 'hola **mundo**', start: 7, end: 12 })
    expect(applyMarkup('hola mundo', 5, 10, 'bold', 'textile').text).toBe('hola *mundo*')
    expect(applyMarkup('ver x', 4, 5, 'code', 'textile').text).toBe('ver @x@')
  })

  it('convierte en lista cada línea seleccionada', () => {
    expect(applyMarkup('a\nb\nc', 2, 5, 'list', 'markdown').text).toBe('a\n- b\n- c')
    expect(applyMarkup('uno', 1, 1, 'list', 'textile').text).toBe('* uno')
  })
})
