import type { ImportCatalog } from './model'
import ExcelJS from 'exceljs'
import {
  columnLetter,
  EXAMPLE_MARK,
  FIRST_DATA_ROW,
  FIXED_COLUMNS,
  SHEET_LISTS,
  SHEET_META,
  SHEET_TASKS,
  TEMPLATE_ROWS,
  TEMPLATE_VERSION,
} from './model'

/**
 * Plantilla de importación (F5-T01): libro con la hoja `Tareas` (cabecera fija,
 * fila de ejemplo en gris, desplegables y formatos), `_listas` con los valores
 * válidos y `_meta` con el proyecto y la versión. Las dos últimas, ocultas.
 */

/** Columnas con desplegable y la lista de `_listas` que usan. */
function listsFor(catalog: ImportCatalog): { header: string, values: string[] }[] {
  return [
    { header: 'Tracker', values: catalog.trackers.map(t => t.name) },
    { header: 'Estado', values: catalog.statuses.map(s => s.name) },
    { header: 'Prioridad', values: catalog.priorities.map(p => p.name) },
    { header: 'Asignado a', values: catalog.members.map(m => m.name) },
    { header: 'Versión', values: catalog.versions.map(v => v.name) },
    { header: 'Categoría', values: catalog.categories.map(c => c.name) },
    ...catalog.customFields.filter(f => f.options?.length).map(f => ({ header: f.name, values: f.options! })),
  ]
}

export function buildTemplate(catalog: ImportCatalog, now = new Date()): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Redmine Client'
  workbook.created = now

  const sheet = workbook.addWorksheet(SHEET_TASKS, { views: [{ state: 'frozen', ySplit: 1 }] })
  const lists = workbook.addWorksheet(SHEET_LISTS)
  const meta = workbook.addWorksheet(SHEET_META)
  lists.state = 'hidden'
  meta.state = 'hidden'

  const columns = [
    ...FIXED_COLUMNS.map(c => ({ header: c.header, width: c.width })),
    ...catalog.customFields.map(f => ({ header: f.name, width: Math.max(14, f.name.length + 4) })),
  ]
  sheet.columns = columns.map(c => ({ header: c.header, width: c.width }))
  const header = sheet.getRow(1)
  header.font = { bold: true }
  header.alignment = { vertical: 'middle' }

  // Fila de ejemplo: en gris y cursiva; "ej." en la columna Fila hace que se ignore.
  const example: (string | number | Date)[] = [
    EXAMPLE_MARK,
    'Ejemplo: revisar el formulario de alta',
    catalog.trackers[0]?.name ?? '',
    'Esta fila se ignora al importar',
    '',
    catalog.priorities[0]?.name ?? '',
    '',
    '',
    '',
    '',
    '',
    '1h30',
    '',
  ]
  const exampleRow = sheet.getRow(2)
  exampleRow.values = example
  exampleRow.font = { italic: true, color: { argb: 'FF8A8A8A' } }

  // Columna Fila prellenada 1..N para referenciar padres.
  for (let i = 0; i < TEMPLATE_ROWS; i++) sheet.getCell(FIRST_DATA_ROW + i, 1).value = i + 1

  const last = FIRST_DATA_ROW + TEMPLATE_ROWS - 1
  const indexOf = (headerName: string) => columns.findIndex(c => c.header === headerName) + 1

  // Desplegables: cada lista en una columna de `_listas`.
  listsFor(catalog).forEach((list, i) => {
    const listColumn = columnLetter(i + 1)
    lists.getCell(1, i + 1).value = list.header
    list.values.forEach((value, row) => {
      lists.getCell(row + 2, i + 1).value = value
    })
    const target = indexOf(list.header)
    if (target <= 0 || list.values.length === 0) return
    const letter = columnLetter(target)
    sheet.dataValidations.add(`${letter}${FIRST_DATA_ROW}:${letter}${last}`, {
      type: 'list',
      allowBlank: true,
      formulae: [`'${SHEET_LISTS}'!$${listColumn}$2:$${listColumn}$${list.values.length + 1}`],
      showErrorMessage: true,
      errorTitle: list.header,
      error: `Elige un valor de la lista de ${list.header}.`,
    })
  })

  // Fechas con formato y validación de fecha; Fila y Padre como texto/número libre.
  for (const name of ['Fecha de inicio', 'Fecha de fin']) {
    const letter = columnLetter(indexOf(name))
    sheet.getColumn(indexOf(name)).numFmt = 'yyyy-mm-dd'
    sheet.dataValidations.add(`${letter}${FIRST_DATA_ROW}:${letter}${last}`, {
      type: 'date',
      operator: 'greaterThan',
      allowBlank: true,
      formulae: [new Date(Date.UTC(2000, 0, 1))],
      showErrorMessage: true,
      errorTitle: name,
      error: 'Escribe una fecha (AAAA-MM-DD).',
    })
  }

  meta.getCell('A1').value = 'project_id'
  meta.getCell('B1').value = catalog.project.id
  meta.getCell('A2').value = 'project_identifier'
  meta.getCell('B2').value = catalog.project.identifier
  meta.getCell('A3').value = 'project_name'
  meta.getCell('B3').value = catalog.project.name
  meta.getCell('A4').value = 'template_version'
  meta.getCell('B4').value = TEMPLATE_VERSION
  meta.getCell('A5').value = 'generated_on'
  meta.getCell('B5').value = now.toISOString()

  return workbook
}

/** El libro listo para descargar. */
export async function templateBuffer(catalog: ImportCatalog, now = new Date()): Promise<ArrayBuffer> {
  const buffer = await buildTemplate(catalog, now).xlsx.writeBuffer()
  return buffer as ArrayBuffer
}

export function templateFilename(catalog: Pick<ImportCatalog, 'project'>): string {
  return `plantilla-tareas-${catalog.project.identifier}.xlsx`
}
