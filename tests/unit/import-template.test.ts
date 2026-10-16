// @vitest-environment node
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { columnLetter, fold, matchByName, templateHeaders } from '../../shared/import/model'
import { templateBuffer } from '../../shared/import/template'
import { catalog } from '../fixtures/import-catalog'

describe('modelo', () => {
  it('compara sin mayúsculas ni acentos', () => {
    expect(fold('  GESTIÓN  de pagos ')).toBe('gestion de pagos')
    expect(matchByName(catalog.categories, 'gestion')?.id).toBe(3)
  })

  it('letras de columna', () => {
    expect([1, 13, 26, 27, 28].map(columnLetter)).toEqual(['A', 'M', 'Z', 'AA', 'AB'])
  })
})

describe('plantilla', () => {
  it('tiene las hojas, las cabeceras y el proyecto en _meta', async () => {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await templateBuffer(catalog, new Date('2026-10-15T10:00:00Z')))

    const tasks = workbook.getWorksheet('Tareas')!
    expect(workbook.getWorksheet('_listas')!.state).toBe('hidden')
    expect(workbook.getWorksheet('_meta')!.state).toBe('hidden')

    const headers = (tasks.getRow(1).values as unknown[]).slice(1)
    expect(headers).toEqual(templateHeaders(catalog))
    expect(headers.slice(-2)).toEqual(['Cliente', 'Notas'])

    expect(tasks.getCell('A2').value).toBe('ej.')
    expect(tasks.getCell('A3').value).toBe(1)
    expect(workbook.getWorksheet('_meta')!.getCell('B1').value).toBe(1)
    expect(workbook.getWorksheet('_meta')!.getCell('B4').value).toBe(1)
  })

  it('pone desplegables con los valores del proyecto', async () => {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await templateBuffer(catalog))
    const tasks = workbook.getWorksheet('Tareas')!
    const tracker = tasks.getCell('C3').dataValidation
    expect(tracker?.type).toBe('list')
    expect(String(tracker?.formulae?.[0])).toContain('_listas')
    expect(tasks.getCell('N3').dataValidation?.type).toBe('list') // Cliente
    expect(tasks.getCell('O3').dataValidation?.type).toBeUndefined() // Notas, texto libre
    const lists = workbook.getWorksheet('_listas')!
    expect(lists.getCell('A2').value).toBe('Errores')
  })
})
