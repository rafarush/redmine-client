// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  boardProjectIds,
  createBoard,
  EMPTY_WORKSPACE,
  moveBoard,
  removeBoard,
  sanitizeWorkspace,
  saveCategory,
} from '../../shared/workspace/model'
import { boardQueries, mergeIssues } from '../../shared/workspace/board-query'
import { adjacentPriority, rankPriorities, sortIssues } from '../../shared/workspace/sort'

let n = 0
const makeId = () => `b${++n}`

describe('workspace: modelo', () => {
  it('sanea lo leído de localStorage', () => {
    expect(sanitizeWorkspace(null)).toEqual(EMPTY_WORKSPACE)
    const ws = sanitizeWorkspace({
      locked: false,
      boards: [
        { id: 'a', kind: 'project', title: 'Portal', projectIds: [1], issueIds: [], span: 2, free: { x: 10, y: 20, w: 400 } },
        { id: 'b', kind: 'otro', title: 'Mal' },
        'basura',
      ],
      categories: [{ id: 'c', name: 'Clientes', projectIds: [1, 'x'] }],
      statusMap: { inProgress: 2, done: 'no' },
    })
    expect(ws.locked).toBe(false)
    expect(ws.boards.map(b => b.id)).toEqual(['a'])
    expect(ws.boards[0]!.span).toBe(2)
    expect(ws.categories[0]!.projectIds).toEqual([])
    expect(ws.statusMap).toEqual({ inProgress: 2, done: undefined, rtqa: undefined })
  })

  it('crea, mueve y quita boards', () => {
    let ws = createBoard(EMPTY_WORKSPACE, { kind: 'project', title: 'Uno', projectIds: [1] }, makeId)
    ws = createBoard(ws, { kind: 'project', title: 'Dos', projectIds: [2] }, makeId)
    ws = createBoard(ws, { kind: 'custom', title: '  ' }, makeId)
    expect(ws.boards.map(b => b.title)).toEqual(['Uno', 'Dos', 'Board'])
    expect(ws.boards[1]!.free.x).toBeGreaterThan(ws.boards[0]!.free.x)

    const moved = moveBoard(ws, ws.boards[2]!.id, 0)
    expect(moved.boards.map(b => b.title)).toEqual(['Board', 'Uno', 'Dos'])
    expect(moveBoard(ws, ws.boards[0]!.id, 99).boards.at(-1)!.title).toBe('Uno')
    expect(removeBoard(ws, ws.boards[0]!.id).boards).toHaveLength(2)
  })

  it('un board de categoría sale de los proyectos de la categoría', () => {
    let ws = saveCategory(EMPTY_WORKSPACE, { id: 'c', name: 'Clientes', projectIds: [3, 4] })
    ws = createBoard(ws, { kind: 'category', title: 'Clientes', categoryId: 'c' }, makeId)
    expect(boardProjectIds(ws.boards[0]!, ws.categories)).toEqual([3, 4])
    ws = saveCategory(ws, { id: 'c', name: 'Clientes', projectIds: [3] })
    expect(boardProjectIds(ws.boards[0]!, ws.categories)).toEqual([3])
  })
})

describe('workspace: orden', () => {
  // Redmine devuelve las prioridades de menor a mayor.
  const priorities = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
  const rank = rankPriorities(priorities)
  const issue = (id: number, priority: number, due?: string | null) => ({ id, priority: { id: priority }, due_date: due })

  it('ordena por prioridad, luego fecha fin (sin fecha al final) y luego número', () => {
    const sorted = sortIssues([
      issue(10, 2, '2026-10-20'),
      issue(11, 4, null),
      issue(12, 2, null),
      issue(13, 2, '2026-10-18'),
      issue(9, 2, '2026-10-18'),
    ], rank)
    expect(sorted.map(i => i.id)).toEqual([11, 9, 13, 10, 12])
  })

  it('da la prioridad vecina para subir y bajar', () => {
    expect(adjacentPriority(priorities, 2, 'up')?.id).toBe(3)
    expect(adjacentPriority(priorities, 2, 'down')?.id).toBe(1)
    expect(adjacentPriority(priorities, 4, 'up')).toBeUndefined()
    expect(adjacentPriority(priorities, 1, 'down')).toBeUndefined()
  })
})

describe('workspace: consultas de un board', () => {
  const base = { id: 'x', title: 'X', span: 1 as const, free: { x: 0, y: 0, w: 560 }, issueIds: [] as number[], issueCategoryIds: [] as number[], projectIds: [] as number[] }

  it('siempre pide mis tareas abiertas, una consulta por proyecto', () => {
    const queries = boardQueries({ ...base, kind: 'category', categoryId: 'c' }, [{ id: 'c', name: 'C', projectIds: [1, 2] }])
    expect(queries).toHaveLength(2)
    expect(queries[0]).toMatchObject({ assigned_to_id: 'me', status_id: 'open', project_id: 1 })
    expect(queries[1]).toMatchObject({ project_id: 2 })
  })

  it('un board de categorías de Redmine filtra por ellas en su proyecto', () => {
    const queries = boardQueries({ ...base, kind: 'category', projectIds: [7], issueCategoryIds: [3, 5] }, [])
    expect(queries).toHaveLength(1)
    expect(queries[0]).toMatchObject({ project_id: 7, category_id: '3,5', assigned_to_id: 'me' })
  })

  it('una lista de tareas sueltas pide por número', () => {
    expect(boardQueries({ ...base, kind: 'custom', issueIds: [4821, 4790] }, [])[0]).toMatchObject({ issue_id: '4821,4790' })
    expect(boardQueries({ ...base, kind: 'custom' }, [])).toEqual([])
  })

  it('une sin repetir', () => {
    expect(mergeIssues([[{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }]]).map(i => i.id)).toEqual([1, 2, 3])
  })
})
