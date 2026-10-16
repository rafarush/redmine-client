// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  comboFromEvent,
  DEFAULT_SHORTCUTS,
  findConflict,
  isBrowserReserved,
  isValidCombo,
  matchesCombo,
  sanitizeShortcuts,
} from '../../shared/shortcuts/keymap'

const press = (key: string, code: string, mods: Partial<{ ctrlKey: boolean, metaKey: boolean, altKey: boolean, shiftKey: boolean }> = {}) =>
  ({ key, code, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods })

describe('atajos: combinaciones', () => {
  it('lee la combinación de un evento con los modificadores en orden fijo', () => {
    expect(comboFromEvent(press('b', 'KeyB', { ctrlKey: true }))).toBe('Mod+B')
    expect(comboFromEvent(press('b', 'KeyB', { metaKey: true }))).toBe('Mod+B')
    expect(comboFromEvent(press('K', 'KeyK', { shiftKey: true, ctrlKey: true, altKey: true }))).toBe('Mod+Alt+Shift+K')
    expect(comboFromEvent(press('5', 'Digit5', { altKey: true }))).toBe('Alt+5')
    expect(comboFromEvent(press('F2', 'F2', { altKey: true }))).toBe('Alt+F2')
    expect(comboFromEvent(press('\\', 'Backslash', { ctrlKey: true }))).toBe('Mod+\\')
  })

  it('con Alt en Mac `key` sale cambiada, pero la letra se toma de `code`', () => {
    expect(comboFromEvent(press('†', 'KeyT', { altKey: true }))).toBe('Alt+T')
  })

  it('un modificador solo no es una combinación', () => {
    expect(comboFromEvent(press('Control', 'ControlLeft', { ctrlKey: true }))).toBeNull()
    expect(comboFromEvent(press('Shift', 'ShiftLeft', { shiftKey: true }))).toBeNull()
  })

  it('compara el evento con una combinación', () => {
    expect(matchesCombo(press('l', 'KeyL', { ctrlKey: true }), 'Mod+L')).toBe(true)
    expect(matchesCombo(press('l', 'KeyL'), 'Mod+L')).toBe(false)
    expect(matchesCombo(press('l', 'KeyL', { ctrlKey: true, shiftKey: true }), 'Mod+L')).toBe(false)
  })

  it('exige Mod o Alt: una letra suelta no es un atajo', () => {
    expect(isValidCombo('Mod+B')).toBe(true)
    expect(isValidCombo('Alt+T')).toBe(true)
    expect(isValidCombo('B')).toBe(false)
    expect(isValidCombo('Shift+B')).toBe(false)
    expect(isValidCombo('Mod+Shift')).toBe(false)
  })

  it('avisa de las que se queda el navegador', () => {
    expect(isBrowserReserved('Mod+T')).toBe(true)
    expect(isBrowserReserved('Alt+T')).toBe(false)
  })
})

describe('atajos: conflictos y lectura', () => {
  it('detecta choques con otra acción y con los atajos fijos', () => {
    expect(findConflict(DEFAULT_SHORTCUTS, 'newIssue', 'Mod+B')).toBe('addBoard')
    expect(findConflict(DEFAULT_SHORTCUTS, 'addBoard', 'Mod+B')).toBeUndefined()
    expect(findConflict(DEFAULT_SHORTCUTS, 'addBoard', 'Mod+K')).toBe('fixed')
    expect(findConflict(DEFAULT_SHORTCUTS, 'addBoard', 'Alt+Y')).toBeUndefined()
  })

  it('sanea lo leído de localStorage', () => {
    expect(sanitizeShortcuts(null)).toEqual(DEFAULT_SHORTCUTS)
    expect(sanitizeShortcuts({ newIssue: 'Mod+T', addBoard: 'b', toggleGrid: 5 }))
      .toEqual({ newIssue: 'Mod+T', addBoard: 'Mod+B', toggleGrid: 'Mod+L' })
  })

  it('si dos acciones quedan con la misma combinación, la repetida vuelve a su valor', () => {
    expect(sanitizeShortcuts({ newIssue: 'Mod+B' }))
      .toEqual({ newIssue: 'Alt+T', addBoard: 'Mod+B', toggleGrid: 'Mod+L' })
  })
})
