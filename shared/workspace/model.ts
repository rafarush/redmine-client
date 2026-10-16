import { z } from 'zod'

/**
 * Modelo del Workspace (F2c): boards de tareas asignadas a mí, guardados en local.
 * Lógica pura; el store (`app/stores/workspace.ts`) solo persiste lo que esto decide.
 *
 * Cada board guarda dos disposiciones: su sitio en la rejilla (orden del array +
 * ancho en columnas) y su posición en el canvas libre. Cambiar el candado no pierde
 * ninguna de las dos.
 */

/** De qué sale la lista: un proyecto, una categoría (grupo de proyectos) o tareas sueltas. */
export type BoardKind = 'project' | 'category' | 'custom'

/** Columnas de la rejilla en ancho regular; en compacto todo es una columna. */
export const GRID_COLUMNS = 2

export interface FreePosition {
  x: number
  y: number
  /** Ancho en px. */
  w: number
}

export interface Board {
  id: string
  kind: BoardKind
  title: string
  /** `project`: uno; `category`: se resuelve desde la categoría; `custom`: vacío. */
  projectIds: number[]
  categoryId?: string
  /** `category`: categorías de tareas de Redmine de las que salen las tareas (de `projectIds`). */
  issueCategoryIds: number[]
  /** `custom`: las tareas elegidas a mano. */
  issueIds: number[]
  /** Columnas que ocupa en la rejilla (1 o 2). */
  span: 1 | 2
  free: FreePosition
}

/** Agrupación local de proyectos definida por el usuario. */
export interface Category {
  id: string
  name: string
  projectIds: number[]
}

/** Estados de Redmine a los que lleva cada paso del flujo de la card. */
export interface StatusMap {
  inProgress?: number
  done?: number
  rtqa?: number
}

export interface Workspace {
  locked: boolean
  boards: Board[]
  categories: Category[]
  statusMap: StatusMap
  /** Ids de estado en el orden de las listas de los boards; vacío = el de por defecto. */
  statusOrder: number[]
}

export const EMPTY_WORKSPACE: Workspace = { locked: true, boards: [], categories: [], statusMap: {}, statusOrder: [] }

export const FREE_BOARD_WIDTH = 560
const FREE_GAP = 24

const ids = z.array(z.number().int().positive()).catch([])
const boardSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['project', 'category', 'custom']),
  title: z.string().min(1).max(80),
  projectIds: ids,
  categoryId: z.string().optional().catch(undefined),
  issueCategoryIds: ids,
  issueIds: ids,
  span: z.union([z.literal(1), z.literal(2)]).catch(1),
  free: z.object({ x: z.number(), y: z.number(), w: z.number().min(280) }).catch({ x: 0, y: 0, w: FREE_BOARD_WIDTH }),
})
const categorySchema = z.object({ id: z.string().min(1), name: z.string().min(1).max(60), projectIds: ids })
const statusId = z.number().int().positive().optional().catch(undefined)

/** Lo leído de `localStorage` puede ser cualquier cosa: se queda con lo que tiene forma. */
export function sanitizeWorkspace(raw: unknown): Workspace {
  if (!raw || typeof raw !== 'object') return structuredClone(EMPTY_WORKSPACE)
  const value = raw as Record<string, unknown>
  const pick = <T>(list: unknown, schema: z.ZodType<T>): T[] =>
    Array.isArray(list)
      ? list.flatMap((item) => {
          const parsed = schema.safeParse(item)
          return parsed.success ? [parsed.data] : []
        })
      : []

  const map = (value.statusMap ?? {}) as Record<string, unknown>
  return {
    locked: value.locked !== false,
    boards: pick(value.boards, boardSchema) as Board[],
    categories: pick(value.categories, categorySchema),
    statusMap: {
      inProgress: statusId.parse(map.inProgress),
      done: statusId.parse(map.done),
      rtqa: statusId.parse(map.rtqa),
    },
    statusOrder: [...new Set(ids.parse(value.statusOrder))],
  }
}

/** Posición libre para un board nuevo: a la derecha del último, o debajo si no cabe. */
export function nextFreePosition(boards: readonly Board[]): FreePosition {
  if (boards.length === 0) return { x: 0, y: 0, w: FREE_BOARD_WIDTH }
  const last = boards[boards.length - 1]!.free
  const x = last.x + last.w + FREE_GAP
  return x + FREE_BOARD_WIDTH <= FREE_BOARD_WIDTH * GRID_COLUMNS + FREE_GAP
    ? { x, y: last.y, w: FREE_BOARD_WIDTH }
    : { x: 0, y: Math.max(...boards.map(b => b.free.y)) + 480 + FREE_GAP, w: FREE_BOARD_WIDTH }
}

export interface BoardInput {
  kind: BoardKind
  title: string
  projectIds?: number[]
  categoryId?: string
  issueCategoryIds?: number[]
  issueIds?: number[]
}

export function createBoard(
  workspace: Workspace,
  input: BoardInput,
  makeId: () => string,
): Workspace {
  const board: Board = {
    id: makeId(),
    kind: input.kind,
    title: input.title.trim().slice(0, 80) || 'Board',
    projectIds: input.projectIds ?? [],
    categoryId: input.categoryId,
    issueCategoryIds: input.issueCategoryIds ?? [],
    issueIds: input.issueIds ?? [],
    span: 1,
    free: nextFreePosition(workspace.boards),
  }
  return { ...workspace, boards: [...workspace.boards, board] }
}

export function updateBoard(workspace: Workspace, id: string, patch: Partial<Omit<Board, 'id'>>): Workspace {
  return { ...workspace, boards: workspace.boards.map(board => board.id === id ? { ...board, ...patch } : board) }
}

/** Añade tareas a una lista, sin repetir y detrás de las que ya había. */
export function addIssuesToBoard(workspace: Workspace, id: string, issueIds: readonly number[]): Workspace {
  const board = workspace.boards.find(b => b.id === id)
  if (!board) return workspace
  return updateBoard(workspace, id, { issueIds: [...new Set([...board.issueIds, ...issueIds])] })
}

export function removeIssueFromBoard(workspace: Workspace, id: string, issueId: number): Workspace {
  const board = workspace.boards.find(b => b.id === id)
  if (!board) return workspace
  return updateBoard(workspace, id, { issueIds: board.issueIds.filter(n => n !== issueId) })
}

export function removeBoard(workspace: Workspace, id: string): Workspace {
  return { ...workspace, boards: workspace.boards.filter(board => board.id !== id) }
}

/** Mueve un board en el orden de la rejilla (el índice se acota a la lista). */
export function moveBoard(workspace: Workspace, id: string, toIndex: number): Workspace {
  const from = workspace.boards.findIndex(board => board.id === id)
  if (from < 0) return workspace
  const boards = [...workspace.boards]
  const [moved] = boards.splice(from, 1)
  boards.splice(Math.min(Math.max(toIndex, 0), boards.length), 0, moved!)
  return { ...workspace, boards }
}

export function saveCategory(workspace: Workspace, category: Category): Workspace {
  const exists = workspace.categories.some(c => c.id === category.id)
  return {
    ...workspace,
    categories: exists
      ? workspace.categories.map(c => c.id === category.id ? category : c)
      : [...workspace.categories, category],
  }
}

/** Proyectos de los que salen las tareas de un board. */
export function boardProjectIds(board: Board, categories: readonly Category[]): number[] {
  // Los boards de categorías de Redmine guardan sus proyectos; los antiguos, un grupo local.
  if (board.kind === 'category' && board.categoryId) return categories.find(c => c.id === board.categoryId)?.projectIds ?? []
  return board.projectIds
}
