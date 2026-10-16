import type { Board, BoardInput, Category, StatusMap, Workspace } from '../../shared/workspace/model'
import type { LoggedWork, Timer } from '../../shared/workspace/flow'
import { currentTimer, pauseTimer, runOnly, sanitizeTimers } from '../../shared/workspace/flow'
import { defineStore } from 'pinia'
import {
  addIssuesToBoard,
  createBoard,
  EMPTY_WORKSPACE,
  moveBoard,
  removeBoard,
  removeIssueFromBoard,
  sanitizeWorkspace,
  saveCategory,
  updateBoard,
} from '../../shared/workspace/model'

const WORKSPACE_KEY = 'redmine-client:workspace'
const TIMERS_KEY = 'redmine-client:timers'
const LOGGED_KEY = 'redmine-client:logged-work'

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  }
  catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  }
  catch {
    // Sin almacenamiento el workspace dura solo esta sesión; no es un error.
  }
}

function sanitizeLogged(raw: unknown): LoggedWork[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((w): w is LoggedWork =>
    !!w && Number.isInteger(w.issueId) && Number.isInteger(w.timeEntryId) && typeof w.hours === 'number').slice(-50)
}

/**
 * Workspace personal (F2c): boards, categorías, mapeo de estados, el cronómetro
 * activo y el último tiempo registrado por tarea (para ajustarlo). Todo en local:
 * es disposición y preferencia, nunca la API key (CLAUDE.md).
 */
export const useWorkspaceStore = defineStore('workspace', () => {
  const workspace = ref<Workspace>(structuredClone(EMPTY_WORKSPACE))
  const timers = ref<Timer[]>([])
  const logged = ref<LoggedWork[]>([])
  const restored = ref(false)

  function restore(): void {
    if (restored.value) return
    workspace.value = sanitizeWorkspace(read(WORKSPACE_KEY))
    timers.value = sanitizeTimers(read(TIMERS_KEY))
    logged.value = sanitizeLogged(read(LOGGED_KEY))
    restored.value = true
  }

  function commit(next: Workspace): void {
    workspace.value = next
    write(WORKSPACE_KEY, next)
  }

  // SPA (`ssr: false`): al crear el store ya hay `localStorage`; así ninguna pantalla
  // pinta el vacío un instante antes de leer los boards.
  if (import.meta.client) restore()

  const boards = computed(() => workspace.value.boards)
  const categories = computed(() => workspace.value.categories)

  function addBoard(input: BoardInput): string {
    const next = createBoard(workspace.value, input, () => crypto.randomUUID())
    commit(next)
    return next.boards.at(-1)!.id
  }

  function patchBoard(id: string, patch: Partial<Omit<Board, 'id'>>): void {
    commit(updateBoard(workspace.value, id, patch))
  }

  /** Quita el board y devuelve cómo deshacerlo (se ofrece en el toast). */
  function deleteBoard(id: string): () => void {
    const before = workspace.value
    commit(removeBoard(before, id))
    return () => commit(before)
  }

  function addIssues(id: string, issueIds: readonly number[]): void {
    commit(addIssuesToBoard(workspace.value, id, issueIds))
  }

  /** Saca una tarea de la lista (no la toca en Redmine) y devuelve cómo deshacerlo. */
  function removeIssue(id: string, issueId: number): () => void {
    const before = workspace.value
    commit(removeIssueFromBoard(before, id, issueId))
    return () => commit(before)
  }

  function reorderBoard(id: string, toIndex: number): void {
    commit(moveBoard(workspace.value, id, toIndex))
  }

  function upsertCategory(category: Category): void {
    commit(saveCategory(workspace.value, category))
  }

  function setLocked(locked: boolean): void {
    commit({ ...workspace.value, locked })
  }

  function setStatusMap(statusMap: StatusMap): void {
    commit({ ...workspace.value, statusMap })
  }

  // ------------------------------------------------------------ cronómetro

  /** El que suma tiempo ahora; si ninguno, el último en pausa (lo muestra la franja). */
  const activeTimer = computed(() => currentTimer(timers.value))

  function saveTimers(next: Timer[]): void {
    timers.value = next
    write(TIMERS_KEY, next)
  }

  /** Arranca o reanuda el de esta tarea y pausa el que corriera: solo uno suma tiempo. */
  function startTimer(issueId: number, now = Date.now()): void {
    saveTimers(runOnly(timers.value, issueId, now))
  }

  function pauseTimerFor(issueId: number, now = Date.now()): void {
    saveTimers(timers.value.map(t => t.issueId === issueId ? pauseTimer(t, now) : t))
  }

  /** Lo quita y lo devuelve, para registrar lo medido. */
  function stopTimer(issueId: number): Timer | undefined {
    const timer = timers.value.find(t => t.issueId === issueId)
    saveTimers(timers.value.filter(t => t.issueId !== issueId))
    return timer
  }

  /** Para deshacer un "parar": lo vuelve a poner como estaba (en pausa si otro corre ya). */
  function restoreTimer(timer: Timer, now = Date.now()): void {
    const others = timers.value.filter(t => t.issueId !== timer.issueId)
    const restored = others.some(t => !t.paused) ? pauseTimer(timer, now) : timer
    saveTimers([...others, restored])
  }

  // ----------------------------------------------------- tiempo registrado

  function loggedFor(issueId: number): LoggedWork | undefined {
    return logged.value.findLast(w => w.issueId === issueId)
  }

  function rememberLogged(work: LoggedWork): void {
    logged.value = [...logged.value.filter(w => w.timeEntryId !== work.timeEntryId), work].slice(-50)
    write(LOGGED_KEY, logged.value)
  }

  function forgetLogged(timeEntryId: number): void {
    logged.value = logged.value.filter(w => w.timeEntryId !== timeEntryId)
    write(LOGGED_KEY, logged.value)
  }

  return {
    workspace,
    boards,
    categories,
    timers,
    activeTimer,
    restore,
    addBoard,
    patchBoard,
    deleteBoard,
    addIssues,
    removeIssue,
    reorderBoard,
    upsertCategory,
    setLocked,
    setStatusMap,
    startTimer,
    pauseTimer: pauseTimerFor,
    stopTimer,
    restoreTimer,
    loggedFor,
    rememberLogged,
    forgetLogged,
  }
})
