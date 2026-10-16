import { describe, expect, it } from 'vitest'
import { sanitizeTheme } from '../../shared/theme'

describe('sanitizeTheme', () => {
  it('acepta los temas conocidos', () => {
    expect(sanitizeTheme('light')).toBe('light')
    expect(sanitizeTheme('dark')).toBe('dark')
    expect(sanitizeTheme('system')).toBe('system')
  })

  it('vuelve a system con valores desconocidos', () => {
    expect(sanitizeTheme(null)).toBe('system')
    expect(sanitizeTheme('sepia')).toBe('system')
  })
})
