import type { Board, Category } from './model'
import { boardProjectIds } from './model'

/**
 * Consultas a Redmine de un board (F2c). Siempre "asignadas a mí" y abiertas:
 * las completadas y en RTQA siguen abiertas en Redmine, así que se ven hasta que
 * alguien las cierre. Un board de varios proyectos hace una consulta por proyecto.
 */
export type IssueQuery = Record<string, string | number>

/** Más que esto en un board ya no es un board, es la lista de tareas. */
export const BOARD_LIMIT = 100

const BASE: IssueQuery = { assigned_to_id: 'me', status_id: 'open', sort: 'priority:desc,due_date', limit: BOARD_LIMIT }

export function boardQueries(board: Board, categories: readonly Category[]): IssueQuery[] {
  if (board.kind === 'custom') {
    // Una lista enseña las tareas que se eligieron a mano, sean de quien sean.
    const { assigned_to_id: _mine, ...open } = BASE
    return board.issueIds.length > 0 ? [{ ...open, issue_id: board.issueIds.join(',') }] : []
  }
  const category: IssueQuery = board.kind === 'category' && board.issueCategoryIds.length > 0
    ? { category_id: board.issueCategoryIds.join(',') }
    : {}
  return boardProjectIds(board, categories).map(projectId => ({ ...BASE, ...category, project_id: projectId }))
}

/** Une las respuestas sin repetir tareas (un subproyecto puede salir en dos consultas). */
export function mergeIssues<T extends { id: number }>(lists: ReadonlyArray<readonly T[]>): T[] {
  const seen = new Set<number>()
  const result: T[] = []
  for (const list of lists) {
    for (const issue of list) {
      if (seen.has(issue.id)) continue
      seen.add(issue.id)
      result.push(issue)
    }
  }
  return result
}
