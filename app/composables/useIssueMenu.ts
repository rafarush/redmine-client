import type { Issue } from '../../shared/redmine/types'

/**
 * Menú contextual de una tarea, uno para toda la app (`IssueContextMenu` en el
 * layout). Lo abre el clic derecho, la tecla Menú o Mayús+F10 sobre cualquier fila
 * o tarjeta de tarea, y el botón "…" de la lista.
 */
export function useIssueMenu() {
  const state = useState<{ issue: Issue, x: number, y: number } | null>('issue-menu', () => null)

  function open(issue: Issue, x: number, y: number): void {
    state.value = { issue, x, y }
  }

  /** Abre el menú pegado a un elemento (teclado o botón), no al puntero. */
  function openAt(issue: Issue, element: Element): void {
    const rect = element.getBoundingClientRect()
    open(issue, rect.left + Math.min(rect.width / 3, 160), rect.top + Math.min(rect.height, 40))
  }

  function close(): void {
    state.value = null
  }

  /** Tecla Menú o Mayús+F10: devuelve true si era el atajo y ya abrió el menú. */
  function handleKey(issue: Issue, event: KeyboardEvent): boolean {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return false
    event.preventDefault()
    openAt(issue, event.currentTarget as Element)
    return true
  }

  return { state, open, openAt, close, handleKey }
}
