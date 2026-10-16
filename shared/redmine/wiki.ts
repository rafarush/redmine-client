import type { TextFormat } from './rich-text'
import type { WikiPageRef } from './types'
import { normalize } from './projects'

/**
 * Wiki (F7): árbol del índice, títulos como los escribe Redmine, enlaces internos
 * `[[Página]]` y la diferencia por líneas para el aviso de conflicto.
 */

/** Página de inicio por defecto de una wiki de Redmine. */
export const START_PAGE = 'Wiki'

/**
 * Título tal como Redmine lo guarda (`Wiki.titleize`): espacios a `_`, sin los
 * signos que no admite y con la primera letra en mayúscula.
 */
export function wikiTitle(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, '_').replace(/[,./?;:|]/g, '')
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

/** Título para leer: "Guía_de_estilo" → "Guía de estilo". */
export function wikiLabel(title: string): string {
  return title.replaceAll('_', ' ')
}

export interface WikiNode {
  page: WikiPageRef
  children: WikiNode[]
}

/** Árbol por `parent`, por título. Un hijo cuyo padre no está sube a la raíz. */
export function buildWikiTree(pages: WikiPageRef[]): WikiNode[] {
  const nodes = new Map(pages.map(page => [page.title, { page, children: [] as WikiNode[] }]))
  const roots: WikiNode[] = []
  for (const node of nodes.values()) {
    const parent = node.page.parent ? nodes.get(node.page.parent.title) : undefined
    if (parent && parent !== node) parent.children.push(node)
    else roots.push(node)
  }
  const sort = (list: WikiNode[]): WikiNode[] => {
    list.sort((a, b) => wikiLabel(a.page.title).localeCompare(wikiLabel(b.page.title), 'es'))
    for (const node of list) sort(node.children)
    return list
  }
  return sort(roots)
}

/** Ramas con alguna página cuyo título contiene `query` (sin acentos ni mayúsculas). */
export function filterWikiTree(nodes: WikiNode[], query: string): WikiNode[] {
  const q = normalize(query)
  if (!q) return nodes
  return nodes.flatMap((node) => {
    if (normalize(wikiLabel(node.page.title)).includes(q)) return [node]
    const children = filterWikiTree(node.children, query)
    return children.length > 0 ? [{ ...node, children }] : []
  })
}

/** La página de inicio: "Wiki" si existe; si no, la primera de la raíz. */
export function startPage(pages: WikiPageRef[]): string | undefined {
  return pages.find(p => p.title === START_PAGE)?.title ?? buildWikiTree(pages)[0]?.page.title
}

/**
 * Convierte `[[Página]]`, `[[Página|texto]]`, `[[Página#ancla]]` y
 * `[[proyecto:Página]]` en enlaces de la app (`/projects/:id/wiki/:título`) en la
 * sintaxis del formato, antes de renderizar. Los bloques de código no se tocan.
 */
export function resolveWikiLinks(text: string, project: string, format: TextFormat): string {
  let inFence = false
  return text.split('\n').map((line) => {
    if (/^\s*(?:```|~~~|<\/?pre>)/.test(line)) inFence = !inFence
    if (inFence) return line
    return line.replace(/\[\[([^\]|\n]+?)(?:\|([^\]\n]+))?\]\]/g, (_match, target: string, label?: string) => {
      const [scope, rest] = target.includes(':') ? target.split(/:(.*)/s) as [string, string] : [project, target]
      const [page = '', anchor] = rest.split('#')
      const href = `/projects/${encodeURIComponent(scope.trim())}/wiki/${encodeURIComponent(wikiTitle(page || START_PAGE))}${anchor ? `#${anchor}` : ''}`
      const shown = (label ?? (target.includes(':') ? rest : target)).trim()
      return format === 'markdown' ? `[${shown}](${href})` : `"${shown}":${href}`
    })
  }).join('\n')
}

export type DiffLine = { kind: 'same' | 'add' | 'del', text: string }

/**
 * Diferencia por líneas (LCS) entre lo que hay en Redmine (`theirs`) y lo que la
 * persona escribió (`mine`). Para páginas de wiki basta: unos cientos de líneas.
 */
export function lineDiff(theirs: string, mine: string): DiffLine[] {
  const a = theirs.split('\n')
  const b = mine.split('\n')
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => Array.from({ length: b.length + 1 }, () => 0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i]! })
      i++
      j++
    }
    else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) out.push({ kind: 'del', text: a[i++]! })
    else out.push({ kind: 'add', text: b[j++]! })
  }
  while (i < a.length) out.push({ kind: 'del', text: a[i++]! })
  while (j < b.length) out.push({ kind: 'add', text: b[j++]! })
  return out
}
