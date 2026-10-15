import type { IssueColumnId } from '../../shared/redmine/issue-columns'
import { defineStore } from 'pinia'
import type { SavedFilter } from '../../shared/redmine/saved-filters'
import { DEFAULT_VISIBLE_COLUMNS, sanitizeColumns, toggleColumn } from '../../shared/redmine/issue-columns'
import { addRecent, sanitizeRecent } from '../../shared/redmine/palette'
import { removeFilter, sanitizeSaved, saveFilter } from '../../shared/redmine/saved-filters'

const SIDEBAR_KEY = 'redmine-client:sidebar-collapsed'
const COLUMNS_KEY = 'redmine-client:issue-columns'
const SAVED_KEY = 'redmine-client:saved-filters'
const RECENT_KEY = 'redmine-client:recent-searches'

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

  const savedFilters = ref<SavedFilter[]>([])
  const recentSearches = ref<string[]>([])
  const paletteOpen = ref(false)

  /** Se llama desde el layout al montar, cuando ya hay `localStorage`. */
  function restore(): void {
    sidebarCollapsed.value = readBool(SIDEBAR_KEY, false)
    try {
      const recent = localStorage.getItem(RECENT_KEY)
      recentSearches.value = sanitizeRecent(recent ? JSON.parse(recent) : null)
    }
    catch {
      recentSearches.value = []
    }
    try {
      const saved = localStorage.getItem(SAVED_KEY)
      savedFilters.value = sanitizeSaved(saved ? JSON.parse(saved) : null)
    }
    catch {
      savedFilters.value = []
    }
    try {
      const raw = localStorage.getItem(COLUMNS_KEY)
      issueColumns.value = sanitizeColumns(raw ? JSON.parse(raw) : null)
    }
    catch {
      issueColumns.value = [...DEFAULT_VISIBLE_COLUMNS]
    }
  }

  function persistSaved(): void {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(savedFilters.value))
    }
    catch {
      // Ver writeBool.
    }
  }

  function persistRecent(): void {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recentSearches.value))
    }
    catch {
      // Ver writeBool.
    }
  }

  function rememberSearch(text: string): void {
    recentSearches.value = addRecent(recentSearches.value, text)
    persistRecent()
  }

  function clearRecentSearches(): void {
    recentSearches.value = []
    persistRecent()
  }

  function saveCurrentFilter(name: string, f: string): void {
    savedFilters.value = saveFilter(savedFilters.value, name, f, () => crypto.randomUUID())
    persistSaved()
  }

  function deleteSavedFilter(id: string): void {
    savedFilters.value = removeFilter(savedFilters.value, id)
    persistSaved()
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

  return { sidebarCollapsed, issueColumns, savedFilters, recentSearches, paletteOpen, rememberSearch, clearRecentSearches, saveCurrentFilter, deleteSavedFilter, restore, toggleSidebar, toggleIssueColumn }
})
