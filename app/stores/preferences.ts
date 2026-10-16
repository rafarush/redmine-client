import type { FormatPreference } from '../../shared/redmine/rich-text'
import { defineStore } from 'pinia'
import { ref } from 'vue'

const FORMAT_KEY = 'redmine-client:text-format'
const FORMATS: FormatPreference[] = ['auto', 'textile', 'markdown']

/** Preferencias de la persona que no son de interfaz (F3-T03): de momento, el formato de texto. */
export const usePreferencesStore = defineStore('preferences', () => {
  const textFormat = ref<FormatPreference>(read())

  function read(): FormatPreference {
    try {
      const saved = localStorage.getItem(FORMAT_KEY) as FormatPreference | null
      return saved && FORMATS.includes(saved) ? saved : 'auto'
    }
    catch {
      return 'auto'
    }
  }

  function setTextFormat(value: FormatPreference): void {
    textFormat.value = value
    try {
      localStorage.setItem(FORMAT_KEY, value)
    }
    catch {
      // Sin almacenamiento la preferencia dura solo esta sesión.
    }
  }

  return { textFormat, setTextFormat }
})
