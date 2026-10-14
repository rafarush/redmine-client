import type { IssueColumnId } from '../../shared/redmine/issue-columns'
import { defineStore } from 'pinia'
import { DEFAULT_VISIBLE_COLUMNS, sanitizeColumns, toggleColumn } from '../../shared/redmine/issue-columns'

const SIDEBAR_KEY = 'redmine-client:sidebar-collapsed'
const COLUMNS_KEY = 'redmine-client:issue-columns'

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
  const issueColumns = ref<IssueColumnId[]>([...DEFAULT_VISIBLE_COLUMNS])

  /** Se llama desde el layout al montar, cuando ya hay `localStorage`. */
  function restore(): void {
    sidebarCollapsed.value = readBool(SIDEBAR_KEY, false)
    try {
      const raw = localStorage.getItem(COLUMNS_KEY)
      issueColumns.value = sanitizeColumns(raw ? JSON.parse(raw) : null)
    }
    catch {
      issueColumns.value = [...DEFAULT_VISIBLE_COLUMNS]
    }
  }

  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
    writeBool(SIDEBAR_KEY, sidebarCollapsed.value)
  }

  function toggleIssueColumn(id: IssueColumnId): void {
    issueColumns.value = toggleColumn(issueColumns.value, id)
    try {
      localStorage.setItem(COLUMNS_KEY, JSON.stringify(issueColumns.value))
    }
    catch {
      // Ver writeBool.
    }
  }

  return { sidebarCollapsed, issueColumns, restore, toggleSidebar, toggleIssueColumn }
})
