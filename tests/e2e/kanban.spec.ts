import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { apiKeyFor, REDMINE_URL } from './_session'

/**
 * Kanban de un board (F2d). Mover una tarjeta cambia la tarea en el Redmine local,
 * así que cada test la devuelve a su estado y sprint de antes.
 */

let adminKey: string

test.beforeAll(() => {
  adminKey = apiKeyFor('admin')
})

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${REDMINE_URL}${path}`, {
    method,
    headers: { 'X-Redmine-API-Key': adminKey, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status}`)
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

async function openKanban(page: Page, project: string): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Añadir board' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Añadir board' })
  await dialog.getByRole('option', { name: new RegExp(project) }).first().click()
  await dialog.getByRole('button', { name: 'Añadir board' }).click()
  await page.getByRole('link', { name: `Abrir ${project} como kanban` }).click()
  await expect(page).toHaveURL(/\/board\/.+\/kanban$/)
}

test.describe('kanban', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 900, 'Se prueba en ancho regular')

  test('agrupa por estado, por sprint y en matriz, con el modo en la URL', async ({ page }) => {
    await openKanban(page, 'Portal Web')
    await expect(page.getByRole('heading', { name: 'Portal Web', level: 1 })).toBeVisible()
    await expect(page.getByRole('group', { name: /^Nueva, \d+ tareas$/ })).toBeVisible()

    await page.getByRole('radio', { name: 'Sprint' }).click()
    await expect(page).toHaveURL(/by=sprint/)
    await expect(page.getByRole('group', { name: /^Sin sprint, \d+ tareas$/ })).toBeVisible()

    await page.getByRole('radio', { name: 'Estado / Sprint' }).click()
    await expect(page).toHaveURL(/by=matrix/)
    await expect(page.getByRole('region', { name: 'Sin sprint' })).toBeVisible()
  })

  test('con teclado, ] lleva la tarjeta a la columna siguiente', async ({ page }) => {
    await openKanban(page, 'Soporte Interno')
    const card = page.locator('[data-kanban] li[data-issue]').first()
    await expect(card).toBeVisible()
    const issueId = Number(await card.getAttribute('data-issue'))
    const { issue } = await api<{ issue: { status: { id: number } } }>('GET', `/issues/${issueId}.json`)

    try {
      await card.focus()
      await page.keyboard.press(']')
      await expect(page.getByRole('status').getByText(`#${issueId} movida a`)).toBeVisible()
      await expect.poll(async () => (await api<{ issue: { status: { id: number } } }>('GET', `/issues/${issueId}.json`)).issue.status.id)
        .not.toBe(issue.status.id)
    }
    finally {
      await api('PUT', `/issues/${issueId}.json`, { issue: { status_id: issue.status.id } })
    }
  })
})
