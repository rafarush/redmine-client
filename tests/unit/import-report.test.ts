// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readWorkbook } from '../../shared/import/read'
import { buildReport, reportFilename } from '../../shared/import/report'
import { buildTemplate } from '../../shared/import/template'
import { validateRows } from '../../shared/import/validate'
import { catalog } from '../fixtures/import-catalog'

async function filledBook(): Promise<ArrayBuffer> {
  const workbook = buildTemplate(catalog)
  const sheet = workbook.getWorksheet('Tareas')!
  sheet.getCell('B3').value = 'Primera'
  sheet.getCell('C3').value = 'Tareas'
  sheet.getCell('B4').value = 'Segunda'
  sheet.getCell('C4').value = 'Tareas'
  return await workbook.xlsx.writeBuffer() as ArrayBuffer
}

describe('reporte', () => {
  it('añade Resultado e ID creado y al reimportarlo no duplica', async () => {
    const report = await buildReport(await filledBook(), [
      { line: 3, status: 'created', id: 120 },
      { line: 4, status: 'error', message: 'Asunto no válido' },
    ])
    const read = await readWorkbook(report)
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(read.rows[0]!.cells['ID creado']).toBe('120')
    expect(read.rows[1]!.cells.Resultado).toBe('Error: Asunto no válido')
    expect(read.headers).not.toContain('Resultado')

    const again = validateRows(read.rows, catalog)
    expect(again.skipped).toEqual([{ line: 3, id: 120 }])
    expect(again.rows.map(r => r.line)).toEqual([4])
  })

  it('un reporte de un reporte reutiliza las columnas', async () => {
    const first = await buildReport(await filledBook(), [{ line: 3, status: 'created', id: 1 }, { line: 4, status: 'cancelled' }])
    const second = await buildReport(first, [{ line: 4, status: 'created', id: 2 }])
    const read = await readWorkbook(second)
    if (!read.ok) throw new Error(read.error)
    expect(read.rows.map(r => r.cells['ID creado'])).toEqual(['1', '2'])
  })

  it('nombre del archivo', () => {
    expect(reportFilename('plantilla-tareas-portal-web.xlsx')).toBe('plantilla-tareas-portal-web-resultado.xlsx')
  })
})
