import { defineStore } from 'pinia'
import { ref } from 'vue'

const SEEN_KEY = 'redmine-client:news-seen'

/**
 * Última visita a Noticias (F7-T04), para el punto de "Novedades" de la sidebar.
 * La primera vez se guarda el momento actual sin avisar de nada.
 */
export const useNewsStore = defineStore('news', () => {
  const lastSeen = ref<string | null>(read())

  function read(): string | null {
    try {
      const value = localStorage.getItem(SEEN_KEY)
      if (value === null) localStorage.setItem(SEEN_KEY, new Date().toISOString())
      return value ?? new Date().toISOString()
    }
    catch {
      return null
    }
  }

  function markSeen(): void {
    lastSeen.value = new Date().toISOString()
    try {
      localStorage.setItem(SEEN_KEY, lastSeen.value)
    }
    catch {
      // Sin almacenamiento el aviso no sobrevive a recargar; no pasa nada.
    }
  }

  return { lastSeen, markSeen }
})
