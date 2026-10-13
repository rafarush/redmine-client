import { expect, test } from '@playwright/test'

/**
 * Checklist de sdd/02-diseno.md para el layout base (F0-T05):
 * teclado, claro y oscuro, ancho compacto y regular.
 */

const sidebar = (page: import('@playwright/test').Page) =>
  page.getByRole('complementary', { name: 'Secciones' })

const tabBar = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: 'Secciones' })

test.describe('ancho regular', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 900, 'Solo en ancho regular')

  test('muestra la sidebar y no la tab bar', async ({ page }) => {
    await page.goto('/')
    await expect(sidebar(page)).toBeVisible()
    await expect(tabBar(page)).toBeHidden()
    await expect(sidebar(page).getByRole('link')).toHaveCount(4)
  })

  test('marca la sección actual para lectores de pantalla', async ({ page }) => {
    await page.goto('/')
    await expect(sidebar(page).getByRole('link', { name: 'Mis tareas' })).toHaveAttribute('aria-current', 'page')
  })

  test('el primer foco es saltar al contenido', async ({ page }) => {
    await page.goto('/')
    // Es una SPA: hay que esperar a que monte antes de mandar teclas.
    await expect(sidebar(page)).toBeVisible()

    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused()
  })

  test('Ctrl+\\ oculta la sidebar y lo recuerda al recargar', async ({ page }) => {
    const alternar = page.getByRole('button', { name: 'Mostrar u ocultar las secciones' })

    await page.goto('/')
    await expect(sidebar(page)).toBeVisible()

    await page.keyboard.press('Control+\\')
    await expect(sidebar(page)).toBeHidden()

    await page.reload()
    await expect(alternar).toBeVisible()
    await expect(sidebar(page)).toBeHidden()

    await page.keyboard.press('Control+\\')
    await expect(sidebar(page)).toBeVisible()
  })

  test('se navega entre secciones con el teclado', async ({ page }) => {
    await page.goto('/')
    await sidebar(page).getByRole('link', { name: 'Tiempo' }).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/tiempo$/)
    await expect(page.getByRole('heading', { name: 'Tiempo' })).toBeVisible()
  })

  test('el botón de solo icono tiene nombre accesible y foco visible', async ({ page }) => {
    await page.goto('/')
    const alternar = page.getByRole('button', { name: 'Mostrar u ocultar las secciones' })
    await expect(alternar).toBeVisible()
    await expect(alternar).toHaveAttribute('aria-expanded', 'true')

    await alternar.focus()
    const grosorOutline = await alternar.evaluate(el => getComputedStyle(el).outlineWidth)
    expect(grosorOutline).not.toBe('0px')
  })

  test('usa los tokens de cada apariencia', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(246, 247, 249)')

    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(17, 19, 22)')
  })
})

test.describe('ancho compacto', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 900, 'Solo en ancho compacto')

  test('cambia la sidebar por la tab bar sin perder secciones', async ({ page }) => {
    await page.goto('/')
    await expect(sidebar(page)).toBeHidden()
    await expect(tabBar(page)).toBeVisible()
    await expect(tabBar(page).getByRole('link')).toHaveCount(4)
  })

  test('no provoca scroll horizontal', async ({ page }) => {
    await page.goto('/')
    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(desborde).toBeLessThanOrEqual(0)
  })
})
