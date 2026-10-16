/**
 * Importación desde Excel (F5): la plantilla v1 y los catálogos contra los que se
 * valida. Ver sdd/fases/F5-importacion-excel.md › Plantilla.
 */

export const TEMPLATE_VERSION = 1
export const SHEET_TASKS = 'Tareas'
export const SHEET_LISTS = '_listas'
export const SHEET_META = '_meta'

/** Marca de la fila de ejemplo (fila 2): se ignora al importar. */
export const EXAMPLE_MARK = 'ej.'
/** Primera fila de datos (1 = cabecera, 2 = ejemplo). */
export const FIRST_DATA_ROW = 3
/** Filas con desplegables preparados. */
export const TEMPLATE_ROWS = 500

/** Columnas fijas, en orden (A..M). Los campos personalizados van detrás. */
export const FIXED_COLUMNS = [
  { key: 'fila', header: 'Fila', width: 7 },
  { key: 'subject', header: 'Asunto', width: 40 },
  { key: 'tracker', header: 'Tracker', width: 16 },
  { key: 'description', header: 'Descripción', width: 40 },
  { key: 'status', header: 'Estado', width: 16 },
  { key: 'priority', header: 'Prioridad', width: 14 },
  { key: 'assignee', header: 'Asignado a', width: 22 },
  { key: 'version', header: 'Versión', width: 18 },
  { key: 'category', header: 'Categoría', width: 18 },
  { key: 'start', header: 'Fecha de inicio', width: 15 },
  { key: 'due', header: 'Fecha de fin', width: 15 },
  { key: 'estimate', header: 'Estimación (h)', width: 14 },
  { key: 'parent', header: 'Padre (fila)', width: 13 },
] as const

export type FixedKey = typeof FIXED_COLUMNS[number]['key']

/** Columnas que añade el reporte (F5-T06). Una fila con `ID creado` no se vuelve a crear. */
export const REPORT_RESULT = 'Resultado'
export const REPORT_CREATED_ID = 'ID creado'

export interface NamedRef { id: number, name: string }

export interface ImportCustomField {
  id: number
  name: string
  /** Valores admitidos si es una lista (solo se conocen con permisos de admin). */
  options?: string[]
}

/** Todo lo que hace falta para generar la plantilla y validar un libro. */
export interface ImportCatalog {
  project: { id: number, identifier: string, name: string }
  trackers: NamedRef[]
  statuses: NamedRef[]
  priorities: NamedRef[]
  members: NamedRef[]
  /** Versiones abiertas. */
  versions: NamedRef[]
  categories: NamedRef[]
  customFields: ImportCustomField[]
}

export function customHeader(field: ImportCustomField): string {
  return field.name
}

/** Cabeceras completas de la hoja `Tareas` para este catálogo. */
export function templateHeaders(catalog: Pick<ImportCatalog, 'customFields'>): string[] {
  return [...FIXED_COLUMNS.map(c => c.header), ...catalog.customFields.map(customHeader)]
}

/** Para comparar sin mayúsculas ni acentos ("gestión" = "Gestion"). */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
}

/** Busca por nombre sin distinguir mayúsculas ni acentos. */
export function matchByName<T extends { name: string }>(list: readonly T[], value: string): T | undefined {
  const wanted = fold(value)
  return list.find(item => fold(item.name) === wanted)
}

/** Letra de columna de Excel: 1 → A, 27 → AA. */
export function columnLetter(index: number): string {
  let n = index
  let out = ''
  while (n > 0) {
    const rest = (n - 1) % 26
    out = String.fromCharCode(65 + rest) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}
