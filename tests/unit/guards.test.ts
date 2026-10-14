// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { hostPermitidoEn, normalizarUrl, quitarApiKey, rutaEstaPermitida } from '../../shared/redmine/guards'

describe('normalizarUrl', () => {
  it('quita la barra final', () => {
    expect(normalizarUrl('https://redmine.local/')).toBe('https://redmine.local')
    expect(normalizarUrl('https://redmine.local///')).toBe('https://redmine.local')
  })

  it('añade https cuando falta el esquema', () => {
    expect(normalizarUrl('redmine.local')).toBe('https://redmine.local')
  })

  it('respeta http y el puerto', () => {
    expect(normalizarUrl('http://localhost:3080')).toBe('http://localhost:3080')
  })

  it('conserva un Redmine montado en un subdirectorio', () => {
    expect(normalizarUrl('https://empresa.local/redmine/')).toBe('https://empresa.local/redmine')
  })

  it('rechaza lo que no es una URL', () => {
    expect(() => normalizarUrl('')).toThrow()
    expect(() => normalizarUrl('javascript:alert(1)')).toThrow()
  })
})

describe('hostPermitidoEn', () => {
  const lista = ['redmine.empresa.local', 'localhost:3080']

  it('acepta un host de la lista', () => {
    expect(hostPermitidoEn(lista, 'https://redmine.empresa.local/issues.json')).toBe(true)
  })

  it('acepta con puerto cuando la lista lo incluye', () => {
    expect(hostPermitidoEn(lista, 'http://localhost:3080/issues.json')).toBe(true)
  })

  it('rechaza un host que no está', () => {
    expect(hostPermitidoEn(lista, 'https://malicioso.example/issues.json')).toBe(false)
    expect(hostPermitidoEn(lista, 'http://169.254.169.254/latest/meta-data')).toBe(false)
  })

  it('no se deja engañar por un subdominio parecido', () => {
    expect(hostPermitidoEn(lista, 'https://redmine.empresa.local.malicioso.example/')).toBe(false)
  })

  it('sin lista configurada no permite nada', () => {
    expect(hostPermitidoEn([], 'https://redmine.empresa.local/')).toBe(false)
    expect(hostPermitidoEn(['', '  '], 'https://redmine.empresa.local/')).toBe(false)
  })
})

describe('rutaEstaPermitida', () => {
  it('acepta rutas de la API', () => {
    expect(rutaEstaPermitida('/issues.json')).toBe(true)
    expect(rutaEstaPermitida('/projects/portal-web/versions.json')).toBe(true)
    expect(rutaEstaPermitida('/enumerations/issue_priorities.json')).toBe(true)
    expect(rutaEstaPermitida('/uploads.json')).toBe(true)
  })

  it('acepta la descarga de un adjunto', () => {
    expect(rutaEstaPermitida('/attachments/download/42/informe.pdf')).toBe(true)
  })

  it('rechaza lo que no es la API', () => {
    expect(rutaEstaPermitida('/admin')).toBe(false)
    expect(rutaEstaPermitida('/issues.html')).toBe(false)
    expect(rutaEstaPermitida('issues.json')).toBe(false)
  })

  it('rechaza intentos de salir de la ruta', () => {
    expect(rutaEstaPermitida('/../../etc/passwd.json')).toBe(false)
    expect(rutaEstaPermitida('/..\\windows.json')).toBe(false)
  })
})

describe('quitarApiKey', () => {
  it('la quita del nivel superior', () => {
    expect(quitarApiKey({ login: 'ana', api_key: 'secreto' })).toEqual({ login: 'ana' })
  })

  it('la quita en profundidad y dentro de arrays', () => {
    const limpio = quitarApiKey({
      users: [{ id: 1, api_key: 'secreto', nested: { api_key: 'otro', ok: true } }],
    })
    expect(JSON.stringify(limpio)).not.toContain('api_key')
    expect(JSON.stringify(limpio)).not.toContain('secreto')
    expect(limpio.users[0]!.nested.ok).toBe(true)
  })

  it('deja intacto lo que no es objeto', () => {
    expect(quitarApiKey(null)).toBeNull()
    expect(quitarApiKey('texto')).toBe('texto')
    expect(quitarApiKey(42)).toBe(42)
  })
})
