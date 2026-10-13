import { defineStore } from 'pinia'

const CLAVE_SIDEBAR = 'redmine-client:sidebar-colapsada'

/** Lee una preferencia local tolerando ventanas privadas o almacenamiento bloqueado. */
function leerBool(clave: string, porDefecto: boolean): boolean {
  try {
    const valor = localStorage.getItem(clave)
    return valor === null ? porDefecto : valor === '1'
  }
  catch {
    return porDefecto
  }
}

function guardarBool(clave: string, valor: boolean): void {
  try {
    localStorage.setItem(clave, valor ? '1' : '0')
  }
  catch {
    // Sin almacenamiento la preferencia dura solo esta sesión; no es un error.
  }
}

/** Preferencias de interfaz que sobreviven a recargar la app. */
export const useUiStore = defineStore('ui', () => {
  const sidebarColapsada = ref(false)

  /** Se llama desde el layout al montar, cuando ya hay `localStorage`. */
  function restaurar(): void {
    sidebarColapsada.value = leerBool(CLAVE_SIDEBAR, false)
  }

  function alternarSidebar(): void {
    sidebarColapsada.value = !sidebarColapsada.value
    guardarBool(CLAVE_SIDEBAR, sidebarColapsada.value)
  }

  return { sidebarColapsada, restaurar, alternarSidebar }
})
