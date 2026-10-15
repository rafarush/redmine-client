import type { FilterSentence } from './filters'
import { toRedmineQuery } from './filters'

/**
 * De la frase de filtros a los parámetros de `/issues.json` (F2-T02).
 *
 * Vive aparte del composable y sin nada de Vue para poder probarlo suelto: es la
 * parte que decide qué se le pide a Redmine y, de rebote, la clave de caché.
 */

/** Tope de Redmine por página. Pedimos la página entera: la lista va virtualizada. */
export const ISSUES_PAGE_SIZE = 100

export interface IssueSort {
  /** Columna de Redmine: `updated_on`, `priority`, `due_date`, `id`... */
  field: string
  direction: 'asc' | 'desc'
}

/** Lo que ordena Redmine por defecto si nadie dice otra cosa. */
export const DEFAULT_SORT: IssueSort = { field: 'updated_on', direction: 'desc' }

/** Consulta guardada de Redmine: sustituye a la frase, que no puede expresarla. */
export interface RedmineQueryRef {
  id: number
  /** Las consultas de un proyecto solo se aplican pidiendo ese proyecto. */
  projectId?: number | null
}

export interface IssueQueryParams {
  sentence: FilterSentence
  savedQuery?: RedmineQueryRef | null
  sort?: IssueSort | null
  /** Página empezando en 0. */
  page?: number
  pageSize?: number
  /** Momento contra el que se resuelven las fechas relativas de la frase. */
  now?: Date
}

/** `{ field: 'updated_on', direction: 'desc' }` → `updated_on:desc`. */
export function sortToParam(sort: IssueSort): string {
  return `${sort.field}:${sort.direction}`
}

/**
 * Parámetros completos de la consulta, filtros incluidos.
 *
 * `offset` y `limit` van aquí y no fuera porque forman parte de la identidad de
 * la petición: dos páginas distintas son dos entradas distintas de la caché.
 */
export function toIssuesQuery(params: IssueQueryParams): Record<string, string | number> {
  const { sentence, savedQuery, sort = DEFAULT_SORT, page = 0, pageSize = ISSUES_PAGE_SIZE, now } = params

  const filters: Record<string, string | number> = savedQuery
    ? { query_id: savedQuery.id, ...(savedQuery.projectId ? { project_id: savedQuery.projectId } : {}) }
    : toRedmineQuery(sentence, now ? { now } : {})

  const query: Record<string, string | number> = {
    ...filters,
    limit: pageSize,
    offset: Math.max(0, page) * pageSize,
  }

  if (sort) query.sort = sortToParam(sort)

  return query
}

/**
 * Clave de caché de vue-query (`sdd/01-arquitectura.md › ADR-004`).
 *
 * Es la consulta ya resuelta, así que dos frases que piden lo mismo comparten
 * caché y una fecha relativa no inventa una clave nueva cada segundo: "esta
 * semana" resuelve al mismo rango durante toda la semana.
 */
export function issuesQueryKey(params: IssueQueryParams): readonly unknown[] {
  return ['issues', toIssuesQuery(params)] as const
}

/** Cuántas páginas hay para ese total. Sin resultados sigue habiendo una página. */
export function pageCount(totalCount: number, pageSize = ISSUES_PAGE_SIZE): number {
  if (pageSize <= 0) return 1
  return Math.max(1, Math.ceil(totalCount / pageSize))
}

/** Deja la página dentro de lo que existe, para no pedir un offset vacío. */
export function clampPage(page: number, totalCount: number, pageSize = ISSUES_PAGE_SIZE): number {
  return Math.min(Math.max(0, Math.trunc(page)), pageCount(totalCount, pageSize) - 1)
}
