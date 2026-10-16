import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { sanitizePinned, togglePinned } from '../../shared/redmine/projects'

const PINNED_KEY = 'redmine-client:pinned-projects'

/** Proyectos fijados (F6-T01): salen en la sidebar. Solo ids, en `localStorage`. */
export const useProjectsStore = defineStore('projects', () => {
  const pinned = ref<number[]>(read())

  function read(): number[] {
    try {
      const raw = localStorage.getItem(PINNED_KEY)
      return sanitizePinned(raw ? JSON.parse(raw) : null)
    }
    catch {
      return []
    }
  }

  function toggle(id: number): void {
    pinned.value = togglePinned(pinned.value, id)
    try {
      localStorage.setItem(PINNED_KEY, JSON.stringify(pinned.value))
    }
    catch {
      // Sin almacenamiento los fijados duran solo esta sesión.
    }
  }

  const isPinned = computed(() => (id: number) => pinned.value.includes(id))

  return { pinned, toggle, isPinned }
})
