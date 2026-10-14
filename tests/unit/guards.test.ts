// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isHostAllowedIn, isPathAllowed, normalizeUrl, stripApiKey } from '../../shared/redmine/guards'

describe('normalizeUrl', () => {
  it('quita la barra final', () => {
    expect(normalizeUrl('https://redmine.local/')).toBe('https://redmine.local')
    expect(normalizeUrl('https://redmine.local///')).toBe('https://redmine.local')
  })

  it('añade https cuando falta el esquema', () => {
    expect(normalizeUrl('redmine.local')).toBe('https://redmine.local')
  })

  it('respeta http y el puerto', () => {
    expect(normalizeUrl('http://localhost:3080')).toBe('http://localhost:3080')
  })

  it('conserva un Redmine montado en un subdirectorio', () => {
    expect(normalizeUrl('https://empresa.local/redmine/')).toBe('https://empresa.local/redmine')
  })

  it('rechaza lo que no es una URL', () => {
    expect(() => normalizeUrl('')).toThrow()
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow()
  })
})

describe('isHostAllowedIn', () => {
  const allowList = ['redmine.empresa.local', 'localhost:3080']

  it('acepta un host de la lista', () => {
    expect(isHostAllowedIn(allowList, 'https://redmine.empresa.local/issues.json')).toBe(true)
  })

  it('acepta con puerto cuando la lista lo incluye', () => {
    expect(isHostAllowedIn(allowList, 'http://localhost:3080/issues.json')).toBe(true)
  })

  it('rechaza un host que no está', () => {
    expect(isHostAllowedIn(allowList, 'https://malicioso.example/issues.json')).toBe(false)
    expect(isHostAllowedIn(allowList, 'http://169.254.169.254/latest/meta-data')).toBe(false)
  })

  it('no se deja engañar por un subdominio parecido', () => {
    expect(isHostAllowedIn(allowList, 'https://redmine.empresa.local.malicioso.example/')).toBe(false)
  })

  it('sin lista configurada no permite nada', () => {
    expect(isHostAllowedIn([], 'https://redmine.empresa.local/')).toBe(false)
    expect(isHostAllowedIn(['', '  '], 'https://redmine.empresa.local/')).toBe(false)
  })
})

describe('isPathAllowed', () => {
  it('acepta rutas de la API', () => {
    expect(isPathAllowed('/issues.json')).toBe(true)
    expect(isPathAllowed('/projects/portal-web/versions.json')).toBe(true)
    expect(isPathAllowed('/enumerations/issue_priorities.json')).toBe(true)
    expect(isPathAllowed('/uploads.json')).toBe(true)
  })

  it('acepta la descarga de un adjunto', () => {
    expect(isPathAllowed('/attachments/download/42/informe.pdf')).toBe(true)
  })

  it('rechaza lo que no es la API', () => {
    expect(isPathAllowed('/admin')).toBe(false)
    expect(isPathAllowed('/issues.html')).toBe(false)
    expect(isPathAllowed('issues.json')).toBe(false)
  })

  it('rechaza intentos de salir de la ruta', () => {
    expect(isPathAllowed('/../../etc/passwd.json')).toBe(false)
    expect(isPathAllowed('/..\\windows.json')).toBe(false)
  })
})

describe('stripApiKey', () => {
  it('la quita del nivel superior', () => {
    expect(stripApiKey({ login: 'ana', api_key: 'secreto' })).toEqual({ login: 'ana' })
  })

  it('la quita en profundidad y dentro de arrays', () => {
    const clean = stripApiKey({
      users: [{ id: 1, api_key: 'secreto', nested: { api_key: 'otro', ok: true } }],
    })
    expect(JSON.stringify(clean)).not.toContain('api_key')
    expect(JSON.stringify(clean)).not.toContain('secreto')
    expect(clean.users[0]!.nested.ok).toBe(true)
  })

  it('deja intacto lo que no es objeto', () => {
    expect(stripApiKey(null)).toBeNull()
    expect(stripApiKey('texto')).toBe('texto')
    expect(stripApiKey(42)).toBe(42)
  })
})
