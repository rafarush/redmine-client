/** Temas que la persona puede elegir; `system` sigue al sistema operativo. */
export const THEMES = ['system', 'light', 'dark'] as const

export type ThemePreference = typeof THEMES[number]

/** Valor guardado -> tema válido; cualquier otra cosa vuelve a `system`. */
export function sanitizeTheme(value: unknown): ThemePreference {
  return THEMES.find(theme => theme === value) ?? 'system'
}
