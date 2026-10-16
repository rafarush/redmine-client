// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  addIssuesToBoard,
  boardProjectIds,
  createBoard,
  EMPTY_WORKSPACE,
  moveBoard,
  removeBoard,
  removeIssueFromBoard,
  sanitizeWorkspace,
  saveCategory,
} from '../../shared/workspace/model'
import { boardQueries, mergeIssues } from '../../shared/workspace/board-query'
import { adjacentPriority, defaultStatusOrder, effectiveStatusOrder, groupByStatus, rankPriorities, resolveStatusRank, sortIssues } from '../../shared/workspace/sort'

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

  it('añade tareas a una lista sin repetir y las quita una a una', () => {
    let ws = createBoard(EMPTY_WORKSPACE, { kind: 'custom', title: 'Semana', issueIds: [10, 11] }, makeId)
    const id = ws.boards[0]!.id
    ws = addIssuesToBoard(ws, id, [11, 12, 12, 13])
    expect(ws.boards[0]!.issueIds).toEqual([10, 11, 12, 13])
    ws = removeIssueFromBoard(ws, id, 11)
    expect(ws.boards[0]!.issueIds).toEqual([10, 12, 13])
    expect(addIssuesToBoard(ws, 'no-existe', [1])).toBe(ws)
    expect(removeIssueFromBoard(ws, 'no-existe', 1)).toBe(ws)
  })

  it('un board de categoría sale de los proyectos de la categoría', () => {
    let ws = saveCategory(EMPTY_WORKSPACE, { id: 'c', name: 'Clientes', projectIds: [3, 4] })
    ws = createBoard(ws, { kind: 'category', title: 'Clientes', categoryId: 'c' }, makeId)
    expect(boardProjectIds(ws.boards[0]!, ws.categories)).toEqual([3, 4])
    ws = saveCategory(ws, { id: 'c', name: 'Clientes', projectIds: [3] })
    expect(boardProjectIds(ws.boards[0]!, ws.categories)).toEqual([3])
  })
})

describe('workspace: estados', () => {
  const statuses = [
    { id: 1, name: 'Nueva' }, { id: 2, name: 'En curso' }, { id: 3, name: 'Resuelta' },
    { id: 4, name: 'Comentarios' }, { id: 5, name: 'Cerrada' },
  ]

  it('por defecto: En curso, Nueva y el resto', () => {
    expect(defaultStatusOrder(statuses)).toEqual([2, 1, 3, 4, 5])
    expect(defaultStatusOrder([{ id: 9, name: 'Closed' }, { id: 8, name: 'To Do' }, { id: 7, name: 'In Progress' }, { id: 6, name: 'New' }])).toEqual([7, 8, 6, 9])
    expect(defaultStatusOrder([{ id: 1, name: 'En proceso' }, { id: 2, name: 'Nuevo' }])).toEqual([1, 2])
  })

  it('el orden guardado manda; ignora estados que ya no existen y añade los nuevos', () => {
    expect(effectiveStatusOrder(statuses, [4, 99, 3, 4])).toEqual([4, 3, 2, 1, 5])
  })

  it('agrupa por estado y conserva prioridad, fecha e id dentro del grupo', () => {
    const priority = rankPriorities([{ id: 1 }, { id: 2 }])
    const issue = (id: number, status: number, prio: number, due?: string) => ({ id, status: { id: status, name: String(status) }, priority: { id: prio }, due_date: due })
    const list = [issue(1, 1, 2), issue(2, 3, 2), issue(3, 2, 1), issue(4, 2, 2, '2026-01-02'), issue(5, 2, 2, '2026-01-01'), issue(6, 99, 2)]
    const sorted = sortIssues(list, priority, resolveStatusRank(statuses, []))
    expect(sorted.map(i => i.id)).toEqual([5, 4, 3, 1, 2, 6])
    expect(groupByStatus(sorted).map(g => [g.statusId, g.issues.length])).toEqual([[2, 3], [1, 1], [3, 1], [99, 1]])
  })

  it('sanitizeWorkspace: statusOrder inválido o duplicado', () => {
    expect(sanitizeWorkspace({}).statusOrder).toEqual([])
    expect(sanitizeWorkspace({ statusOrder: [2, 2, 1] }).statusOrder).toEqual([2, 1])
    expect(sanitizeWorkspace({ statusOrder: 'x' }).statusOrder).toEqual([])
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
    const query = boardQueries({ ...base, kind: 'custom', issueIds: [4821, 4790] }, [])[0]!
    expect(query).toMatchObject({ issue_id: '4821,4790', status_id: 'open' })
    expect(query).not.toHaveProperty('assigned_to_id')
    expect(boardQueries({ ...base, kind: 'custom' }, [])).toEqual([])
  })

  it('une sin repetir', () => {
    expect(mergeIssues([[{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }]]).map(i => i.id)).toEqual([1, 2, 3])
  })
})
