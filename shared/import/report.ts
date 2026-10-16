import type { ItemResult } from './batch'
import ExcelJS from 'exceljs'
import { REPORT_CREATED_ID, REPORT_RESULT, SHEET_TASKS } from './model'
import { cellText } from './read'

/**
 * Reporte de la importación (F5-T06): el mismo libro con dos columnas más,
 * `Resultado` e `ID creado`. Volver a importarlo con las fallidas corregidas no
 * duplica nada: las filas con `ID creado` se saltan (ver `validateRows`).
 */

function describe(result: ItemResult): string {
  switch (result.status) {
    case 'created': return 'Creada'
    case 'error': return `Error: ${result.message}`
    case 'skipped': return result.message
    case 'cancelled': return 'No creada: importación cancelada'
  }
}

export async function buildReport(original: ArrayBuffer, results: readonly ItemResult[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(original)
  const sheet = workbook.getWorksheet(SHEET_TASKS)!

  // Si ya es un reporte, se reutilizan sus columnas; si no, se añaden al final.
  const header = sheet.getRow(1)
  let resultCol = 0
  let idCol = 0
  header.eachCell({ includeEmpty: false }, (cell, col) => {
    const text = cellText(cell.value)
    if (text === REPORT_RESULT) resultCol = col
    if (text === REPORT_CREATED_ID) idCol = col
  })
  const lastCol = header.cellCount
  if (!resultCol) resultCol = lastCol + 1
  if (!idCol) idCol = Math.max(lastCol, resultCol) + 1
  header.getCell(resultCol).value = REPORT_RESULT
  header.getCell(idCol).value = REPORT_CREATED_ID
  header.getCell(resultCol).font = { bold: true }
  header.getCell(idCol).font = { bold: true }
  sheet.getColumn(resultCol).width = 44
  sheet.getColumn(idCol).width = 11

  for (const result of results) {
    sheet.getCell(result.line, resultCol).value = describe(result)
    if (result.status === 'created') sheet.getCell(result.line, idCol).value = result.id
  }

  return await workbook.xlsx.writeBuffer() as ArrayBuffer
}

export function reportFilename(original: string): string {
  return original.replace(/\.xlsx$/i, '') + '-resultado.xlsx'
}
