/**
 * Filtros guardados en local (F2-T06). Guardan la frase ya serializada (`?f=`), así
 * que abrirlos es navegar a `/?f=...` y las fechas relativas se siguen resolviendo al consultar.
 */
export interface SavedFilter {
  id: string
  name: string
  /** Frase en formato `?f=` (ver `toUrl`). */
  f: string
}

export const MAX_NAME_LENGTH = 60

/** Nombre sin espacios sobrantes y con tope de longitud; vacío si no queda nada. */
export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH)
}

/**
 * Guarda `f` con ese nombre. Un nombre repetido (sin distinguir mayúsculas)
 * reemplaza el anterior en vez de duplicarlo. Sin nombre o sin frase no hay nada que guardar.
 */
export function saveFilter(list: readonly SavedFilter[], name: string, f: string, makeId: () => string): SavedFilter[] {
  const clean = cleanName(name)
  if (!clean || !f) return [...list]

  const existing = list.find(item => item.name.toLowerCase() === clean.toLowerCase())
  if (existing) return list.map(item => item === existing ? { ...item, name: clean, f } : item)
  return [...list, { id: makeId(), name: clean, f }]
}

export function removeFilter(list: readonly SavedFilter[], id: string): SavedFilter[] {
  return list.filter(item => item.id !== id)
}

/** Lo leído de `localStorage` puede ser cualquier cosa: se queda con lo que tiene forma de filtro. */
export function sanitizeSaved(raw: unknown): SavedFilter[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const result: SavedFilter[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const { id, name, f } = item as Record<string, unknown>
    if (typeof id !== 'string' || typeof name !== 'string' || typeof f !== 'string') continue
    const clean = cleanName(name)
    if (!id || !clean || !f || seen.has(id)) continue
    seen.add(id)
    result.push({ id, name: clean, f })
  }
  return result
}
