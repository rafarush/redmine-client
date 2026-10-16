import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { apiKeyFor, connect } from './_session'

/**
 * F2: lista de tareas, frase de filtros, vistas, filtros guardados, búsqueda global
 * y cambio rápido. Usa el Redmine local (docker compose up -d && pnpm seed).
 */

const sidebar = (page: import('@playwright/test').Page) =>
  page.getByRole('complementary', { name: 'Secciones' })

test.describe('lista de tareas', () => {
  test('una vista de la sidebar filtra y la URL la lleva', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 900, 'Vistas en la sidebar: ancho regular')
    await page.goto('/issues')
    await sidebar(page).getByRole('link', { name: 'Mis tareas' }).click()
    await expect(page).toHaveURL(/\?f=assigned_to_id/)
    await expect(page.getByRole('grid', { name: 'Tareas' })).toBeVisible()
  })

  test('filtrar, abrir el menú de la fila y ver las acciones del desarrollador', async ({ page }) => {
    await page.goto('/issues?f=status_id:%3D:open')
    const grid = page.getByRole('grid', { name: 'Tareas' })
    const firstRow = grid.getByRole('row').nth(1)
    await expect(firstRow).toBeVisible()

    await firstRow.getByRole('button', { name: /Acciones de la tarea/ }).click()
    await expect(page.getByRole('menuitem', { name: 'Cambiar estado' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Copiar enlace' })).toBeVisible()
  })

  test('cambiar el estado desde la fila y deshacerlo', async ({ page }) => {
    await page.goto('/issues?f=status_id:%3D:open')
    const firstRow = page.getByRole('grid', { name: 'Tareas' }).getByRole('row').nth(1)
    await firstRow.getByRole('button', { name: /Acciones de la tarea/ }).click()

    // Teclado: se abre el submenú de estados, se enfoca la primera opción y Enter la elige.
    await page.getByRole('menuitem', { name: 'Cambiar estado' }).focus()
    await page.keyboard.press('ArrowRight')
    // El estado actual sale deshabilitado: se elige el primero distinto.
    const firstOption = page.getByRole('menu').last().locator('[role="menuitem"]:not([data-disabled])').first()
    await expect(firstOption).toBeVisible()
    await firstOption.focus()
    await page.keyboard.press('Enter')

    const changed = page.getByRole('status').filter({ hasText: 'Estado cambiado' })
    await expect(changed).toBeVisible({ timeout: 10_000 })

    // Deshacer devuelve la tarea a su estado: así el seed queda como estaba.
    await changed.getByRole('button', { name: 'Deshacer' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Cambio deshecho' })).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('permisos del cliente', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('el cliente no ve las acciones de cambio, solo copiar y abrir', async ({ page }) => {
    await connect(page, apiKeyFor('cliente'))
    await expect(page).toHaveURL(/\/$/)

    await page.goto('/issues?f=status_id:%3D:open')
    const firstRow = page.getByRole('grid', { name: 'Tareas' }).getByRole('row').nth(1)
    await firstRow.getByRole('button', { name: /Acciones de la tarea/ }).click()

    await expect(page.getByRole('menuitem', { name: 'Copiar enlace' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Cambiar estado' })).toHaveCount(0)
  })
})

test.describe('frase y filtros guardados', () => {
  test('guardar un filtro lo deja en la sidebar y lo reabre', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 900, 'Sidebar: ancho regular')
    const name = `Abiertas e2e ${Date.now()}`
    await page.goto('/issues?f=status_id:%3D:open')
    await page.getByRole('button', { name: 'Guardar filtro' }).click()
    await page.getByLabel('Nombre del filtro').fill(name)
    await page.getByRole('button', { name: 'Guardar filtro' }).last().click()

    const saved = sidebar(page).getByRole('link', { name })
    await expect(saved).toBeVisible()
    await page.goto('/')
    await sidebar(page).getByRole('link', { name }).click()
    await expect(page).toHaveURL(/\?f=status_id/)
  })
})

/** Abre la búsqueda global. Reintenta el atajo: el listener nace al montar la SPA. */
async function openPalette(page: Page): Promise<Locator> {
  await page.goto('/')
  await expect(page.getByRole('main')).toBeVisible()
  const input = page.getByRole('combobox', { name: 'Buscar' })
  await expect(async () => {
    await page.keyboard.press('Control+k')
    await expect(input).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: 15_000 })
  return input
}

test.describe('búsqueda global', () => {
  test('Ctrl+K abre, filtra comandos y Enter navega', async ({ page }) => {
    const input = await openPalette(page)
    await expect(input).toBeFocused()

    await input.fill('tiempo')
    await expect(page.getByRole('option', { name: 'Ir a Tiempo' })).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/time$/)
  })

  test('el texto busca tareas por asunto', async ({ page }) => {
    const input = await openPalette(page)
    await input.fill('a')
    await expect(page.getByRole('status').filter({ hasText: /resultados|Sin resultados|Buscando/ }).first()).toBeAttached({ timeout: 10_000 })
  })
})
