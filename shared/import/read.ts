import ExcelJS from 'exceljs'
import {
  EXAMPLE_MARK,
  FIXED_COLUMNS,
  REPORT_CREATED_ID,
  REPORT_RESULT,
  SHEET_META,
  SHEET_TASKS,
  TEMPLATE_VERSION,
} from './model'

/**
 * Leer un libro de importación (F5-T02): solo convierte el Excel en filas de texto
 * por cabecera y lee `_meta`. Validar contra el proyecto es cosa de `validate.ts`.
 */

export interface RawRow {
  /** Fila de Excel (1 = cabecera). */
  line: number
  /** Texto de cada celda por cabecera. Fechas en `AAAA-MM-DD`. */
  cells: Record<string, string>
}

export interface TemplateMeta {
  projectId: number
  projectIdentifier: string
  projectName: string
  version: number
}

export type ReadResult
  = | { ok: true, meta: TemplateMeta, headers: string[], rows: RawRow[] }
    | { ok: false, error: string }

const pad = (n: number) => String(n).padStart(2, '0')

/** Texto de una celda de exceljs: fechas, fórmulas, texto enriquecido e hipervínculos. */
export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    // exceljs da las fechas en UTC: se usan sus componentes UTC para no correr un día.
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`
  }
  if (typeof value === 'object') {
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue)
    if ('richText' in value) return value.richText.map(part => part.text).join('')
    if ('text' in value) return String(value.text)
    if ('error' in value) return ''
  }
  return String(value).trim()
}

export async function readWorkbook(data: ArrayBuffer): Promise<ReadResult> {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(data)
  }
  catch {
    return { ok: false, error: 'El archivo no es un Excel (.xlsx) válido.' }
  }

  const sheet = workbook.getWorksheet(SHEET_TASKS)
  if (!sheet) return { ok: false, error: `No encuentro la hoja "${SHEET_TASKS}". ¿Es la plantilla de importación?` }

  const meta = workbook.getWorksheet(SHEET_META)
  const metaValue = (label: string) => {
    for (let r = 1; r <= (meta?.rowCount ?? 0); r++) {
      if (cellText(meta!.getCell(r, 1).value) === label) return cellText(meta!.getCell(r, 2).value)
    }
    return ''
  }
  const projectId = Number(metaValue('project_id'))
  if (!meta || !Number.isInteger(projectId) || projectId <= 0) {
    return { ok: false, error: 'A este libro le falta la hoja oculta "_meta". Descarga la plantilla otra vez.' }
  }
  const version = Number(metaValue('template_version'))
  if (version !== TEMPLATE_VERSION) {
    return { ok: false, error: `Esta plantilla es de otra versión (${version || '?'}). Descarga la actual.` }
  }

  const headers: string[] = []
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = cellText(cell.value)
  })
  const missing = FIXED_COLUMNS.map(c => c.header).filter(h => !headers.includes(h))
  if (missing.length > 0) return { ok: false, error: `Faltan columnas en la hoja "${SHEET_TASKS}": ${missing.join(', ')}.` }

  const rows: RawRow[] = []
  sheet.eachRow({ includeEmpty: false }, (row, line) => {
    if (line === 1) return
    const cells: Record<string, string> = {}
    headers.forEach((header, i) => {
      if (header) cells[header] = cellText(row.getCell(i + 1).value)
    })
    if (cells.Fila === EXAMPLE_MARK) return
    // Una fila con solo el número prellenado está vacía.
    const filled = Object.entries(cells).some(([header, text]) => header !== 'Fila' && header !== REPORT_RESULT && text !== '')
    if (filled) rows.push({ line, cells })
  })

  return {
    ok: true,
    meta: { projectId, projectIdentifier: metaValue('project_identifier'), projectName: metaValue('project_name'), version },
    headers: headers.filter(h => h && h !== REPORT_RESULT && h !== REPORT_CREATED_ID),
    rows,
  }
}
