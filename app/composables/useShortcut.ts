import type { ShortcutId } from '../../shared/shortcuts/keymap'
import { matchesCombo } from '../../shared/shortcuts/keymap'

/**
 * Atajos personalizables (F2c-T12). Cada pantalla registra lo que sabe hacer
 * (`useShortcut`) y el layout despacha el teclado (`runShortcut`): así Ctrl+B y
 * Ctrl+L solo actúan mientras el workspace está en pantalla y, fuera, el navegador
 * conserva el suyo.
 */
const handlers = new Map<ShortcutId, () => void>()

/** Registra el manejador mientras el componente esté montado. */
export function useShortcut(id: ShortcutId, handler: () => void): void {
  onMounted(() => handlers.set(id, handler))
  onBeforeUnmount(() => {
    if (handlers.get(id) === handler) handlers.delete(id)
  })
}

/** Despacha un evento de teclado; devuelve true si lo atendió un atajo (y ya hizo `preventDefault`). */
export function runShortcut(event: KeyboardEvent): boolean {
  const shortcuts = useShortcutsStore()
  if (shortcuts.capturing || event.repeat) return false

  // Mientras se escribe, o con un diálogo abierto, Ctrl+B es del editor o del diálogo.
  const target = event.target as HTMLElement | null
  const typing = !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  if (typing || document.querySelector('[role="dialog"]')) return false

  for (const [id, handler] of handlers) {
    if (!matchesCombo(event, shortcuts.bindings[id])) continue
    event.preventDefault()
    handler()
    return true
  }
  return false
}
