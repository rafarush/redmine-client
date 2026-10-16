/**
 * Lógica pura de la búsqueda global (F2-T07): qué ha escrito la persona, qué comandos
 * hay y cómo se guardan las búsquedas recientes. El componente solo pinta.
 */

export type ParsedSearch
  = | { kind: 'empty' }
    | { kind: 'issue-id', id: number }
    | { kind: 'text', text: string }

/** `#4821` o `4821` es una tarea; cualquier otra cosa es texto. */
export function parseSearch(input: string): ParsedSearch {
  const text = input.trim().replace(/\s+/g, ' ')
  if (!text) return { kind: 'empty' }

  const match = /^#?(\d{1,9})$/.exec(text)
  if (match) {
    const id = Number(match[1])
    if (id > 0) return { kind: 'issue-id', id }
  }
  return { kind: 'text', text }
}

export interface PaletteCommand {
  id: string
  label: string
  icon: string
  /** Ruta a la que lleva. Los comandos que abren diálogos llegan con F3 y F4. */
  to: string
  /** Palabras extra con las que también se encuentra. */
  keywords?: string[]
}

export const PALETTE_COMMANDS: readonly PaletteCommand[] = [
  { id: 'go-workspace', label: 'Ir al Workspace', icon: 'lucide:layout-dashboard', to: '/', keywords: ['inicio', 'boards', 'mis tareas'] },
  { id: 'go-issues', label: 'Ir a Tareas', icon: 'lucide:ticket', to: '/issues', keywords: ['lista'] },
  { id: 'go-time', label: 'Ir a Tiempo', icon: 'lucide:timer', to: '/time', keywords: ['horas', 'imputar'] },
  { id: 'go-projects', label: 'Ir a Proyectos', icon: 'lucide:folder-kanban', to: '/projects' },
  { id: 'go-wiki', label: 'Ir a Wiki', icon: 'lucide:book-open', to: '/wiki' },
]

/** Sin acentos y en minúsculas, para que "proyecto" encuentre "Proyecto" y "ingenieria" a "Ingeniería". */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** Todos los términos escritos tienen que aparecer, en cualquier orden. */
export function matches(haystack: string, query: string): boolean {
  const target = normalize(haystack)
  return normalize(query).split(' ').filter(Boolean).every(term => target.includes(term))
}

export function filterCommands(query: string, commands: readonly PaletteCommand[] = PALETTE_COMMANDS): PaletteCommand[] {
  if (!query.trim()) return [...commands]
  return commands.filter(command => matches([command.label, ...(command.keywords ?? [])].join(' '), query))
}

export function filterByName<T extends { name: string }>(items: readonly T[], query: string, limit: number): T[] {
  if (!query.trim()) return []
  return items.filter(item => matches(item.name, query)).slice(0, limit)
}

// ------------------------------------------------------------ recientes

export const MAX_RECENT = 6

/** La búsqueda más reciente va primero y no se repite (sin distinguir mayúsculas). */
export function addRecent(list: readonly string[], input: string): string[] {
  const text = input.trim().replace(/\s+/g, ' ').slice(0, 80)
  if (!text) return [...list]
  const rest = list.filter(item => item.toLowerCase() !== text.toLowerCase())
  return [text, ...rest].slice(0, MAX_RECENT)
}

export function sanitizeRecent(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const result: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const text = item.trim().replace(/\s+/g, ' ').slice(0, 80)
    if (text && !result.some(r => r.toLowerCase() === text.toLowerCase())) result.push(text)
  }
  return result.slice(0, MAX_RECENT)
}
