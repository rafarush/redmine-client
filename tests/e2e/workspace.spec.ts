import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { apiKeyFor, REDMINE_URL } from './_session'

/**
 * Workspace (F2c): boards de mis tareas y el flujo rápido de la card.
 *
 * Cambia estados y registra tiempo en el Redmine local de verdad, así que cada test
 * guarda cómo estaba la tarea y la deja igual al terminar (API con la clave de admin).
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

/** Deja la tarea con su estado y sus horas de antes. */
async function restore(issueId: number, statusId: number, entriesBefore: number[]): Promise<void> {
  await api('PUT', `/issues/${issueId}.json`, { issue: { status_id: statusId } })
  const { time_entries } = await api<{ time_entries: { id: number }[] }>('GET', `/time_entries.json?issue_id=${issueId}&limit=100`)
  for (const entry of time_entries.filter(e => !entriesBefore.includes(e.id))) {
    await api('DELETE', `/time_entries/${entry.id}.json`)
  }
}

async function snapshot(issueId: number): Promise<{ statusId: number, entries: number[] }> {
  const { issue } = await api<{ issue: { status: { id: number } } }>('GET', `/issues/${issueId}.json`)
  const { time_entries } = await api<{ time_entries: { id: number }[] }>('GET', `/time_entries.json?issue_id=${issueId}&limit=100`)
  return { statusId: issue.status.id, entries: time_entries.map(e => e.id) }
}

async function addProjectBoard(page: Page, name: string): Promise<Locator> {
  await page.goto('/')
  await expect(page.getByText('Tu panel está vacío')).toBeVisible()
  await page.getByRole('button', { name: 'Añadir board' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Añadir board' })
  await dialog.getByRole('option', { name: new RegExp(name) }).first().click()
  await dialog.getByRole('button', { name: 'Añadir board' }).click()
  const board = page.getByRole('region', { name, exact: true })
  await expect(board).toBeVisible()
  return board
}

/** El aviso con ese texto (hay más de una región `status` en la página). */
const toast = (page: Page, text: string) => page.getByRole('status').getByText(text, { exact: false })

test.describe('workspace', () => {
  test('sin boards ofrece empezar y un board muestra mis tareas', async ({ page }) => {
    const board = await addProjectBoard(page, 'Soporte Interno')
    await expect(board.getByRole('listitem').first()).toBeVisible()
    await expect(page.getByRole('region', { name: 'Resumen de hoy' })).toBeVisible()

    // La disposición sobrevive a recargar.
    await page.reload()
    await expect(page.getByRole('region', { name: 'Soporte Interno', exact: true })).toBeVisible()
  })

  test('doble clic: en curso con cronómetro, otra vez: completada con tiempo, y RTQA', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 900, 'El flujo se prueba en un ancho')
    const board = await addProjectBoard(page, 'Soporte Interno')
    const row = board.locator('li[data-stage="idle"]').first()
    await expect(row).toBeVisible()
    const issueId = Number(await row.getAttribute('data-issue'))
    const before = await snapshot(issueId)

    try {
      await row.dblclick()
      await expect(toast(page, `#${issueId} en curso`)).toBeVisible()
      const card = board.locator(`li[data-issue="${issueId}"]`)
      await expect(card).toHaveAttribute('data-stage', 'in_progress')
      await expect(page.getByRole('region', { name: 'Resumen de hoy' })).toContainText(`#${issueId}`)

      await card.dblclick()
      await expect(toast(page, `#${issueId} completada`)).toBeVisible()
      await expect(card).toHaveAttribute('data-stage', 'done')
      await expect.poll(async () => (await snapshot(issueId)).entries.length).toBe(before.entries.length + 1)

      // RTQA necesita un estado: se elige en Ajustes (el Redmine de pruebas no tiene uno con QA).
      await page.getByRole('button', { name: 'Ajustes del workspace' }).click()
      const settings = page.getByRole('dialog', { name: 'Ajustes del workspace' })
      await settings.getByRole('combobox', { name: /RTQA/ }).selectOption({ label: 'Comentarios' })
      await settings.getByRole('button', { name: 'Guardar' }).click()

      await card.getByRole('button', { name: `Pasar #${issueId} a RTQA` }).click()
      await expect(toast(page, `#${issueId} en RTQA`)).toBeVisible()
    }
    finally {
      await restore(issueId, before.statusId, before.entries)
    }
  })

  test('ajustar el tiempo de una tarea con el cronómetro', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 900, 'Se prueba en un ancho')
    const board = await addProjectBoard(page, 'Soporte Interno')
    const row = board.locator('li[data-stage="idle"]').first()
    const issueId = Number(await row.getAttribute('data-issue'))
    const before = await snapshot(issueId)

    try {
      await row.dblclick()
      const card = board.locator(`li[data-issue="${issueId}"]`)
      await expect(card).toHaveAttribute('data-stage', 'in_progress')
      await card.dblclick()
      await expect(card).toHaveAttribute('data-stage', 'done')

      await card.getByRole('button', { name: `Ajustar el tiempo de #${issueId}` }).click()
      const dialog = page.getByRole('dialog', { name: `Tiempo de #${issueId}` })
      await dialog.getByRole('textbox', { name: /Registrado al completar/ }).fill('1h 30')
      await expect(dialog).toContainText('Se guardará como 1 h 30 min')
      await dialog.getByRole('button', { name: 'Guardar tiempo' }).click()
      await expect(toast(page, 'Tiempo ajustado')).toBeVisible()
      await expect(card).toContainText('1 h 30 min')
    }
    finally {
      await restore(issueId, before.statusId, before.entries)
    }
  })

  test('el cronómetro se pausa y se reanuda, y ⏹ registra el tiempo', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 900, 'Se prueba en un ancho')
    const board = await addProjectBoard(page, 'Soporte Interno')
    const row = board.locator('li[data-stage="idle"]').first()
    const issueId = Number(await row.getAttribute('data-issue'))
    const before = await snapshot(issueId)

    try {
      await row.dblclick()
      const card = board.locator(`li[data-issue="${issueId}"]`)
      await card.getByRole('button', { name: `Pausar el cronómetro de #${issueId}` }).click()
      await expect(card).toContainText('En pausa')
      await card.getByRole('button', { name: `Reanudar el cronómetro de #${issueId}` }).click()
      await expect(card).toContainText('En curso')

      await card.getByRole('button', { name: `Parar y registrar el tiempo de #${issueId}` }).click()
      await expect(toast(page, `registradas en #${issueId}`)).toBeVisible()
      await expect.poll(async () => (await snapshot(issueId)).entries.length).toBe(before.entries.length + 1)
      await expect(card.getByRole('button', { name: /cronómetro de #/ })).toHaveCount(0)
    }
    finally {
      await restore(issueId, before.statusId, before.entries)
    }
  })

  test('▲ sube la prioridad y la fila queda marcada', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 900, 'Se prueba en un ancho')
    const board = await addProjectBoard(page, 'Soporte Interno')
    const up = board.getByRole('button', { name: /^Subir la prioridad de #/ }).and(board.locator(':enabled')).first()
    const label = await up.getAttribute('aria-label')
    const issueId = Number(label!.match(/#(\d+)/)![1])
    const { issue } = await api<{ issue: { priority: { id: number } } }>('GET', `/issues/${issueId}.json`)

    try {
      await up.click()
      await expect(toast(page, `Prioridad de #${issueId} subida`)).toBeVisible()
      await expect(board.locator(`li[data-issue="${issueId}"]`)).toContainText('Subida · ahora')
    }
    finally {
      await api('PUT', `/issues/${issueId}.json`, { issue: { priority_id: issue.priority.id } })
    }
  })

  test('un clic abre el detalle y el clic derecho el menú de la tarea', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 900, 'Se prueba en un ancho')
    const board = await addProjectBoard(page, 'Soporte Interno')
    const row = board.locator('li[data-issue]').first()
    const issueId = Number(await row.getAttribute('data-issue'))

    await row.click({ button: 'right' })
    const menu = page.getByRole('menu')
    await expect(menu.getByRole('menuitem', { name: 'Ver detalles' })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Cambiar estado' })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Registrar tiempo…' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()

    await row.click()
    await expect(page).toHaveURL(new RegExp(`/issues/${issueId}$`))
    await expect(page.getByRole('region', { name: 'Datos de la tarea' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Cronómetro y flujo' })).toBeVisible()
  })

  test('el candado alterna rejilla y lienzo libre', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 900, 'El lienzo libre es de ancho regular')
    await addProjectBoard(page, 'Soporte Interno')
    const lock = page.getByRole('button', { name: /^Desbloquear/ })
    await expect(lock).toHaveAttribute('aria-pressed', 'true')
    await lock.click()
    await expect(page.locator('.workspace-canvas')).toBeVisible()
    await page.getByRole('button', { name: /^Bloquear/ }).click()
    await expect(page.locator('.workspace-canvas')).toHaveCount(0)
  })

  test('los enlaces antiguos a la lista llevan a /issues', async ({ page }) => {
    await page.goto('/?f=status_id:%3D:open')
    await expect(page).toHaveURL(/\/issues\?f=status_id/)
    await expect(page.getByRole('grid', { name: 'Tareas' })).toBeVisible()
  })
})
