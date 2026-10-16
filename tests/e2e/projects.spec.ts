import { expect, test } from '@playwright/test'

/**
 * Proyectos (F6-T01..T03): navegador, fijar en la sidebar con teclado, página de
 * proyecto y roadmap. Usa los proyectos del seed (`portal-web`).
 */

test.describe('proyectos', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('redmine-client:pinned-projects'))
  })

  test('busca, fija con teclado y abre el proyecto desde la sidebar', async ({ page }) => {
    await page.goto('/projects')
    const panel = page.getByRole('region', { name: 'Proyectos' })
    await panel.getByPlaceholder('Buscar proyecto…').fill('portal')
    const link = panel.getByRole('link', { name: 'Portal Web', exact: true })
    await expect(link).toBeVisible()

    const pin = panel.getByRole('button', { name: 'Fijar Portal Web en la sidebar' })
    await pin.focus()
    await page.keyboard.press('Enter')
    await expect(panel.getByRole('button', { name: 'Quitar Portal Web de la sidebar' })).toHaveAttribute('aria-pressed', 'true')

    // En compacto no hay sidebar (es la tab bar): se abre desde la fila.
    if ((page.viewportSize()?.width ?? 1280) >= 900) {
      const sidebar = page.getByRole('navigation', { name: 'Proyectos' })
      await sidebar.getByRole('link', { name: /Portal Web/ }).click()
      await expect(page).toHaveURL(/\/projects\/portal-web$/)
    }
    else {
      await link.click()
    }
    await expect(page.getByRole('region', { name: 'Tareas por tracker' })).toBeVisible()
  })

  test('los números de la página llevan a la lista filtrada y hay roadmap', async ({ page }) => {
    await page.goto('/projects/portal-web')
    const trackers = page.getByRole('region', { name: 'Tareas por tracker' })
    await trackers.getByRole('link', { name: /abiertas/ }).first().click()
    await expect(page).toHaveURL(/\/issues\?f=.*project_id/)

    await page.goto('/projects/portal-web/versions')
    await expect(page.getByRole('region', { name: 'Versiones abiertas' })).toBeVisible()
  })
})
