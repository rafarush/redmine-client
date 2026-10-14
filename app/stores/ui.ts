import { defineStore } from 'pinia'

const SIDEBAR_KEY = 'redmine-client:sidebar-collapsed'

/** Lee una preferencia local tolerando ventanas privadas o almacenamiento bloqueado. */
function readBool(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : value === '1'
  }
  catch {
    return fallback
  }
}

function writeBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  }
  catch {
    // Sin almacenamiento la preferencia dura solo esta sesión; no es un error.
  }
}

/** Preferencias de interfaz que sobreviven a recargar la app. */
export const useUiStore = defineStore('ui', () => {
  const sidebarCollapsed = ref(false)

  /** Se llama desde el layout al montar, cuando ya hay `localStorage`. */
  function restore(): void {
    sidebarCollapsed.value = readBool(SIDEBAR_KEY, false)
  }

  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
    writeBool(SIDEBAR_KEY, sidebarCollapsed.value)
  }

  return { sidebarCollapsed, restore, toggleSidebar }
})
