import type { FilterCondition, FilterSentence } from './filters'
import type { Project, Version } from './types'
import { toUrl } from './filters'

/**
 * Proyectos y versiones (F6): el árbol del navegador, los fijados, la próxima
 * versión y el avance de una versión calculado como el roadmap de Redmine.
 */

/** `status` de Redmine: 1 activo, 5 cerrado, 9 archivado. */
export const ARCHIVED = 9

export interface ProjectNode {
  project: Project
  children: ProjectNode[]
}

/** Árbol por `parent`, sin archivados y por nombre. Un hijo cuyo padre no se ve sube a la raíz. */
export function buildProjectTree(projects: Project[]): ProjectNode[] {
  const visible = projects.filter(p => p.status !== ARCHIVED)
  const nodes = new Map(visible.map(p => [p.id, { project: p, children: [] as ProjectNode[] }]))
  const roots: ProjectNode[] = []
  for (const node of nodes.values()) {
    const parent = node.project.parent ? nodes.get(node.project.parent.id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const sort = (list: ProjectNode[]): ProjectNode[] => {
    list.sort((a, b) => a.project.name.localeCompare(b.project.name, 'es'))
    for (const node of list) sort(node.children)
    return list
  }
  return sort(roots)
}

/** Minúsculas y sin acentos, para buscar "gestion" y encontrar "Gestión". */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * Deja las ramas con algún proyecto cuyo nombre o identificador contiene `query`.
 * Se conservan los antecesores (para ver dónde está) y, del que coincide, todos sus hijos.
 */
export function filterProjectTree(nodes: ProjectNode[], query: string): ProjectNode[] {
  const q = normalize(query)
  if (!q) return nodes
  return nodes.flatMap((node) => {
    if (normalize(node.project.name).includes(q) || normalize(node.project.identifier).includes(q)) return [node]
    const children = filterProjectTree(node.children, query)
    return children.length > 0 ? [{ ...node, children }] : []
  })
}

/** Número de proyectos de un subárbol, sin contar la raíz. */
export function countDescendants(node: ProjectNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0)
}

// ------------------------------------------------------------------ fijados

/** Lo guardado en `localStorage`: ids únicos, en el orden en que se fijaron. */
export function sanitizePinned(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter((id): id is number => Number.isInteger(id) && id > 0))]
}

export function togglePinned(pinned: number[], id: number): number[] {
  return pinned.includes(id) ? pinned.filter(p => p !== id) : [...pinned, id]
}

// ---------------------------------------------------------------- versiones

/** Abiertas por fecha (las que no tienen fecha, al final) y luego por nombre. */
export function sortVersions(versions: Version[]): Version[] {
  return [...versions].sort((a, b) => {
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date) || a.name.localeCompare(b.name, 'es')
    if (a.due_date) return -1
    if (b.due_date) return 1
    return a.name.localeCompare(b.name, 'es')
  })
}

/** La próxima versión abierta: la de fecha más cercana que no haya pasado; si todas pasaron, la más atrasada. */
export function nextVersion(versions: Version[], today: string): Version | undefined {
  const open = sortVersions(versions.filter(v => v.status === 'open'))
  return open.find(v => !v.due_date || v.due_date >= today) ?? open[0]
}

/** Días de `today` a `due` (negativo si ya pasó). */
export function daysUntil(due: string, today: string): number {
  return Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
}

export function describeDaysLeft(due: string | null | undefined, today: string): string {
  if (!due) return 'Sin fecha'
  const days = daysUntil(due, today)
  if (days === 0) return 'Vence hoy'
  if (days === 1) return 'Queda 1 día'
  if (days > 1) return `Quedan ${days} días`
  return days === -1 ? 'Venció ayer' : `Venció hace ${-days} días`
}

export interface ProgressIssue {
  closed: boolean
  done_ratio: number
  estimated_hours?: number | null
}

export interface VersionProgress {
  total: number
  closed: number
  /** 0–100, como el roadmap de Redmine. */
  percent: number
  /** "18 de 25 · 72 %". */
  label: string
}

/**
 * Avance de una versión igual que `Version#completed_percent` de Redmine: cada
 * tarea pesa su estimación (o la media de las estimadas, 1 si no hay ninguna); una
 * cerrada cuenta al 100 % y una abierta a su `done_ratio`.
 */
export function versionProgress(issues: ProgressIssue[]): VersionProgress {
  const total = issues.length
  const closed = issues.filter(i => i.closed).length
  let percent = 0
  if (total > 0 && closed === total) percent = 100
  else if (total > 0) {
    const estimated = issues.flatMap(i => i.estimated_hours != null ? [i.estimated_hours] : [])
    const average = estimated.length ? estimated.reduce((a, b) => a + b, 0) / estimated.length : 0
    const weight = average > 0 ? average : 1
    const done = issues.reduce((sum, i) => sum + (i.estimated_hours ?? weight) * (i.closed ? 100 : i.done_ratio), 0)
    percent = done / (weight * total)
  }
  const shown = Math.floor(percent)
  return { total, closed, percent: Math.min(100, percent), label: `${closed} de ${total} · ${Math.min(100, shown)} %` }
}

// ---------------------------------------------------------- enlaces a la lista

/** `?f=` de la lista de tareas para estas condiciones. */
export function issuesLink(conditions: FilterCondition[]): { path: string, query: { f: string } } {
  const sentence: FilterSentence = { conditions }
  return { path: '/issues', query: { f: toUrl(sentence) } }
}
