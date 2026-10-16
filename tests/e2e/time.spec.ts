import { expect, test } from '@playwright/test'
import { apiKeyFor, REDMINE_URL } from './_session'

/**
 * Parte semanal (F4-T06/T07): añadir una tarea, escribir horas en la celda de hoy,
 * ajustarlas y vaciar la celda para borrar. Deja el Redmine local como estaba.
 */

let key: string

test.beforeAll(() => {
  key = apiKeyFor('desarrollador')
})

async function api<T>(method: string, path: string): Promise<T> {
  const response = await fetch(`${REDMINE_URL}${path}`, { method, headers: { 'X-Redmine-API-Key': key } })
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status}`)
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

function localToday(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

test.describe('tiempo', () => {
  test('registra, ajusta y borra horas desde el parte', async ({ page }) => {
    const { issues } = await api<{ issues: { id: number }[] }>('GET', '/issues.json?assigned_to_id=me&status_id=open&limit=1')
    const issueId = issues[0]!.id
    const day = localToday()
    const before = await api<{ time_entries: { id: number }[] }>('GET', `/time_entries.json?user_id=me&from=${day}&to=${day}&limit=100`)

    try {
      await page.goto('/time')
      await expect(page.getByRole('table', { name: 'Horas por tarea y día' })).toBeVisible()

      await page.getByLabel('Número de la tarea a añadir').fill(String(issueId))
      await page.getByRole('button', { name: 'Añadir tarea' }).click()

      const cell = page.getByLabel(new RegExp(`^Tarea #${issueId}, `)).and(page.locator('input')).nth(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1)
      await expect(cell).toBeFocused()
      await cell.fill('45')
      await expect(page.getByText('= 45 min')).toBeVisible()
      await cell.press('Enter')
      await expect(cell).toHaveValue('0:45')

      await cell.fill('1h30')
      await cell.press('Enter')
      await expect(cell).toHaveValue('1:30')
      await expect(page.getByRole('region', { name: 'Registros de la semana' }).getByText('1:30').first()).toBeVisible()

      await cell.fill('')
      await cell.press('Enter')
      await expect(page.getByRole('status').getByText('borrado', { exact: false })).toBeVisible()
    }
    finally {
      const after = await api<{ time_entries: { id: number }[] }>('GET', `/time_entries.json?user_id=me&from=${day}&to=${day}&limit=100`)
      const known = new Set(before.time_entries.map(e => e.id))
      for (const entry of after.time_entries.filter(e => !known.has(e.id))) await api('DELETE', `/time_entries/${entry.id}.json`)
    }
  })

  test('navega entre semanas con la semana en la URL', async ({ page }) => {
    await page.goto('/time')
    await page.getByRole('button', { name: 'Semana anterior' }).click()
    await expect(page).toHaveURL(/\?w=\d{4}-\d{2}-\d{2}/)
    await page.getByRole('button', { name: 'Esta semana' }).click()
    await expect(page).not.toHaveURL(/w=/)
  })
})
