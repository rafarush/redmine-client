import { z } from 'zod'

/**
 * Atajos de teclado personalizables del workspace (F2c-T12). Una combinación es
 * texto en la notación de `UiKbd`: modificadores en orden fijo y la tecla al final
 * (`Mod+B`, `Alt+T`, `Mod+Shift+K`). `Mod` es Ctrl o ⌘.
 */
export type ShortcutId = 'newIssue' | 'addBoard' | 'toggleGrid'

export const SHORTCUT_IDS: readonly ShortcutId[] = ['newIssue', 'addBoard', 'toggleGrid']

/**
 * Ctrl+T abre una pestaña nueva y Chrome/Edge no dejan capturarlo en la web, por eso
 * "nueva tarea" arranca en Alt+T. Ctrl+B y Ctrl+L solo actúan en el workspace.
 */
export const DEFAULT_SHORTCUTS: Readonly<Record<ShortcutId, string>> = {
  newIssue: 'Alt+T',
  addBoard: 'Mod+B',
  toggleGrid: 'Mod+L',
}

/** Atajos de la app que no se pueden reasignar. */
export const FIXED_SHORTCUTS: readonly string[] = ['Mod+K', 'Mod+\\']

/** Combinaciones que el navegador se queda: en la web no llegan a la app. */
export const BROWSER_RESERVED: readonly string[] = [
  'Mod+T',
  'Mod+N',
  'Mod+W',
  'Mod+Shift+T',
  'Mod+Shift+N',
  'Mod+Shift+W',
]

export interface KeyEventLike {
  key: string
  code?: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

const MODIFIER_KEYS = new Set(['Control', 'Meta', 'Alt', 'Shift', 'AltGraph', 'OS'])

/** La tecla sin modificadores: por `code` las letras y cifras (con Alt, `key` sale cambiada en Mac). */
function baseKey(event: KeyEventLike): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null
  const letter = /^Key([A-Z])$/.exec(event.code ?? '')
  if (letter) return letter[1]!
  const digit = /^Digit(\d)$/.exec(event.code ?? '')
  if (digit) return digit[1]!
  if (event.key === ' ') return 'Space'
  return event.key.length === 1 ? event.key.toUpperCase() : event.key
}

/** La combinación de un evento, o `null` si solo se ha pulsado un modificador. */
export function comboFromEvent(event: KeyEventLike): string | null {
  const key = baseKey(event)
  if (!key) return null
  const parts: string[] = []
  if (event.ctrlKey || event.metaKey) parts.push('Mod')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  return [...parts, key].join('+')
}

export function matchesCombo(event: KeyEventLike, combo: string): boolean {
  return comboFromEvent(event) === combo
}

/** Sin Mod o Alt una letra suelta se comería lo que se escribe: no vale como atajo. */
export function isValidCombo(combo: string): boolean {
  const parts = combo.split('+')
  const key = parts.at(-1)
  return !!key && !MODIFIER_KEYS.has(key) && (parts.includes('Mod') || parts.includes('Alt'))
}

export function isBrowserReserved(combo: string): boolean {
  return BROWSER_RESERVED.includes(combo)
}

/** Con qué choca `combo` si se le asigna a `id`: otro atajo del workspace o uno fijo de la app. */
export function findConflict(
  bindings: Readonly<Record<ShortcutId, string>>,
  id: ShortcutId,
  combo: string,
): ShortcutId | 'fixed' | undefined {
  if (FIXED_SHORTCUTS.includes(combo)) return 'fixed'
  return SHORTCUT_IDS.find(other => other !== id && bindings[other] === combo)
}

const comboSchema = z.string().refine(isValidCombo)

/** Lo leído de localStorage: lo que no sea una combinación válida vuelve al valor por defecto. */
export function sanitizeShortcuts(raw: unknown): Record<ShortcutId, string> {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const result = { ...DEFAULT_SHORTCUTS }
  for (const id of SHORTCUT_IDS) {
    const parsed = comboSchema.safeParse(source[id])
    if (parsed.success) result[id] = parsed.data
  }
  // Dos acciones con la misma combinación no dispararían ninguna bien: la que choca vuelve a la suya.
  for (const id of SHORTCUT_IDS) {
    if (findConflict(result, id, result[id])) result[id] = DEFAULT_SHORTCUTS[id]
  }
  return result
}
