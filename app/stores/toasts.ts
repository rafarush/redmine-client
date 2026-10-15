import { defineStore } from 'pinia'

export interface Toast {
  id: number
  /** Texto que se anuncia; el verbo dice lo que pasó ("Estado cambiado"). */
  message: string
  /** Acción opcional, p. ej. "Deshacer". */
  action?: { label: string, run: () => void | Promise<void> }
}

const LIFETIME_MS = 6000
let nextId = 1

/** Avisos breves con acción opcional (sdd/02-diseno.md › Escritura). */
export const useToastStore = defineStore('toasts', () => {
  const items = ref<Toast[]>([])

  function dismiss(id: number): void {
    items.value = items.value.filter(toast => toast.id !== id)
  }

  function show(message: string, action?: Toast['action']): void {
    const id = nextId++
    items.value = [...items.value.slice(-2), { id, message, action }]
    setTimeout(() => dismiss(id), LIFETIME_MS)
  }

  return { items, show, dismiss }
})
