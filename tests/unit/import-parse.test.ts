// @vitest-environment node
import type { RawRow } from '../../shared/import/read'
import type ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { readWorkbook } from '../../shared/import/read'
import { buildTemplate } from '../../shared/import/template'
import { parseDate, projectMismatch, validateRows } from '../../shared/import/validate'
import { catalog } from '../fixtures/import-catalog'

/** Plantilla del catálogo con estas filas desde la fila 3 (valores por columna A..). */
async function book(rows: (string | number | Date | null)[][], edit?: (wb: ExcelJS.Workbook) => void): Promise<ArrayBuffer> {
  const workbook = buildTemplate(catalog)
  const sheet = workbook.getWorksheet('Tareas')!
  rows.forEach((values, i) => {
    values.forEach((value, col) => {
      if (value !== null) sheet.getCell(3 + i, col + 1).value = value
    })
  })
  edit?.(workbook)
  return await workbook.xlsx.writeBuffer() as ArrayBuffer
}

function raw(line: number, cells: Record<string, string>): RawRow {
  return { line, cells }
}

describe('leer el libro', () => {
  it('lee un libro válido, ignora la fila de ejemplo y las vacías', async () => {
    const result = await readWorkbook(await book([
      [1, 'Montar login', 'Tareas', 'Texto', '', 'Urgente', 'dani desarrollo', 'Sprint 1', 'gestion', new Date(Date.UTC(2026, 9, 10)), '2026-10-20', '1h30', ''],
      [2, 'Pantalla de alta', 'errores', '', '', '', '', '', '', '', '', '4', '1', 'Acme', 'libre'],
    ]))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.meta.projectId).toBe(1)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]!.line).toBe(3)
    expect(result.rows[0]!.cells['Fecha de inicio']).toBe('2026-10-10')

    const { rows, errors } = validateRows(result.rows, catalog)
    expect(errors).toEqual([])
    expect(rows[0]!.payload).toEqual({
      project_id: 1,
      subject: 'Montar login',
      tracker_id: 2,
      priority_id: 5,
      assigned_to_id: 5,
      fixed_version_id: 2,
      category_id: 3,
      description: 'Texto',
      start_date: '2026-10-10',
      due_date: '2026-10-20',
      estimated_hours: 1.5,
    })
    expect(rows[1]!.parent).toEqual({ kind: 'row', fila: 1 })
    expect(rows[1]!.payload?.custom_fields).toEqual([{ id: 7, value: 'Acme' }, { id: 8, value: 'libre' }])
  })

  it('rechaza lo que no es un xlsx y libros sin la estructura', async () => {
    expect(await readWorkbook(new TextEncoder().encode('hola').buffer as ArrayBuffer)).toEqual({ ok: false, error: 'El archivo no es un Excel (.xlsx) válido.' })

    const noMeta = await book([], wb => wb.removeWorksheet(wb.getWorksheet('_meta')!.id))
    expect((await readWorkbook(noMeta)).ok).toBe(false)

    const renamed = await book([], (wb) => {
      wb.getWorksheet('Tareas')!.name = 'Otra'
    })
    expect(await readWorkbook(renamed)).toMatchObject({ ok: false, error: expect.stringContaining('"Tareas"') })
  })
})

describe('validar', () => {
  it('cada tipo de error en su celda', () => {
    const { errors, rows } = validateRows([
      raw(3, { Fila: '1', Asunto: '', Tracker: 'Inventado' }),
      raw(4, { 'Fila': '2', 'Asunto': 'x', 'Tracker': 'Tareas', 'Fecha de inicio': '2026-10-20', 'Fecha de fin': '2026-10-10', 'Estimación (h)': 'mucho' }),
      raw(5, { 'Fila': '3', 'Asunto': 'x', 'Tracker': 'Tareas', 'Fecha de inicio': '31/02/2026', 'Cliente': 'Gamma', 'Padre (fila)': '9' }),
      raw(6, { 'Fila': '4', 'Asunto': 'x', 'Tracker': 'Tareas', 'Padre (fila)': '#77' }),
    ], catalog, { existingIssueIds: new Set([1]) })

    expect(errors).toEqual(expect.arrayContaining([
      { line: 3, column: 'Asunto', message: 'Obligatorio' },
      { line: 3, column: 'Tracker', message: '"Inventado" no existe en Portal Web' },
      { line: 4, column: 'Fecha de fin', message: 'Es anterior a la fecha de inicio' },
      { line: 4, column: 'Estimación (h)', message: 'No se entiende (ej.: 4, 1h30)' },
      { line: 5, column: 'Fecha de inicio', message: 'Fecha no válida (AAAA-MM-DD)' },
      { line: 5, column: 'Cliente', message: '"Gamma" no es un valor de Cliente' },
      { line: 5, column: 'Padre (fila)', message: 'La fila 9 no está' },
      { line: 6, column: 'Padre (fila)', message: 'La tarea #77 no existe o no la ves' },
    ]))
    expect(rows.every(r => r.payload === null)).toBe(true)
  })

  it('detecta ciclos y filas repetidas', () => {
    const { errors } = validateRows([
      raw(3, { 'Fila': '1', 'Asunto': 'a', 'Tracker': 'Tareas', 'Padre (fila)': '3' }),
      raw(4, { 'Fila': '2', 'Asunto': 'b', 'Tracker': 'Tareas', 'Padre (fila)': '1' }),
      raw(5, { 'Fila': '3', 'Asunto': 'c', 'Tracker': 'Tareas', 'Padre (fila)': '2' }),
      raw(6, { Fila: '3', Asunto: 'd', Tracker: 'Tareas' }),
    ], catalog)
    expect(errors.filter(e => e.message === 'Los padres forman un ciclo').map(e => e.line).sort()).toEqual([3, 4, 5])
    expect(errors).toContainEqual({ line: 6, column: 'Fila', message: 'La fila 3 está repetida' })
  })

  it('excluir una fila la quita y avisa a sus hijas', () => {
    const rows = [
      raw(3, { Fila: '1', Asunto: 'a', Tracker: 'Tareas' }),
      raw(4, { 'Fila': '2', 'Asunto': 'b', 'Tracker': 'Tareas', 'Padre (fila)': '1' }),
    ]
    expect(validateRows(rows, catalog).errors).toEqual([])
    const excluded = validateRows(rows, catalog, { excluded: new Set([3]) })
    expect(excluded.rows).toHaveLength(1)
    expect(excluded.errors).toEqual([{ line: 4, column: 'Padre (fila)', message: 'La fila 1 no está o está excluida' }])
  })

  it('las filas con ID creado de un reporte se saltan', () => {
    const result = validateRows([raw(3, { 'Fila': '1', 'Asunto': 'a', 'Tracker': 'Tareas', 'ID creado': '120' })], catalog)
    expect(result.rows).toEqual([])
    expect(result.skipped).toEqual([{ line: 3, id: 120 }])
  })

  it('una plantilla de otro proyecto', () => {
    expect(projectMismatch({ projectId: 9, projectIdentifier: 'app', projectName: 'App móvil', version: 1 }, catalog))
      .toBe('Esta plantilla es del proyecto App móvil. Descarga la de Portal Web o cambia de proyecto.')
    expect(projectMismatch({ projectId: 1, projectIdentifier: 'portal-web', projectName: 'Portal Web', version: 1 }, catalog)).toBeNull()
  })

  it('fechas a mano', () => {
    expect(parseDate('2026-10-05')).toBe('2026-10-05')
    expect(parseDate('5/10/2026')).toBe('2026-10-05')
    expect(parseDate('31/02/2026')).toBeUndefined()
  })
})
