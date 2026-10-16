import type { ShortcutId } from '../../shared/shortcuts/keymap'
import { defineStore } from 'pinia'
import { DEFAULT_SHORTCUTS, sanitizeShortcuts } from '../../shared/shortcuts/keymap'

const KEY = 'redmine-client:shortcuts'

/**
 * Atajos personalizados (F2c-T12). Solo se guardan en local: son preferencia, no
 * datos de Redmine. `capturing` silencia los atajos mientras se graba uno nuevo.
 */
export const useShortcutsStore = defineStore('shortcuts', () => {
  const bindings = ref<Record<ShortcutId, string>>({ ...DEFAULT_SHORTCUTS })
  const capturing = ref(false)

  function restore(): void {
    try {
      const raw = localStorage.getItem(KEY)
      bindings.value = sanitizeShortcuts(raw ? JSON.parse(raw) : null)
    }
    catch {
      bindings.value = { ...DEFAULT_SHORTCUTS }
    }
  }

  function commit(next: Record<ShortcutId, string>): void {
    bindings.value = next
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    }
    catch {
      // Sin almacenamiento el cambio dura solo esta sesión; no es un error.
    }
  }

  if (import.meta.client) restore()

  function setBinding(id: ShortcutId, combo: string): void {
    commit({ ...bindings.value, [id]: combo })
  }

  function resetBinding(id: ShortcutId): void {
    commit({ ...bindings.value, [id]: DEFAULT_SHORTCUTS[id] })
  }

  function resetAll(): void {
    commit({ ...DEFAULT_SHORTCUTS })
  }

  return { bindings, capturing, setBinding, resetBinding, resetAll }
})
