import { expect, test } from '@playwright/test'
import { apiKeyFor, connect, REDMINE_URL } from './_session'

/**
 * Flujo de conexión contra el Redmine local (F1-T04, F1-T06, F1-T07).
 *
 * Necesita `docker compose -f docker/compose.dev.yml up -d && pnpm seed`.
 * Las claves se leen del contenedor para no fijarlas en el repositorio.
 */

// Este archivo prueba el propio login, así que arranca sin la sesión compartida.
test.use({ storageState: { cookies: [], origins: [] } })

let developerKey: string
let clientKey: string

test.beforeAll(() => {
  developerKey = apiKeyFor('desarrollador')
  clientKey = apiKeyFor('cliente')
  expect(developerKey).toMatch(/^[0-9a-f]{40}$/)
})

test.describe('conexión', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 900, 'Basta con comprobarlo en un ancho')

  test('sin sesión, cualquier ruta lleva a conectar', async ({ page }) => {
    await page.goto('/projects')
    await expect(page).toHaveURL(/\/connect$/)
    await expect(page.getByRole('heading', { name: 'Conecta con tu Redmine' })).toBeVisible()
  })

  test('una clave inválida lo dice en el campo de la clave', async ({ page }) => {
    await connect(page, '0'.repeat(40))

    const alert = page.getByRole('alert')
    await expect(alert).toContainText('no es válida')
    await expect(page.getByLabel('Clave de acceso a la API')).toHaveAttribute('aria-invalid', 'true')
    await expect(page).toHaveURL(/\/connect$/)
  })

  test('una URL que no es Redmine lo explica', async ({ page }) => {
    await page.goto('/connect')
    await page.getByLabel('Dirección de Redmine').fill(`${REDMINE_URL}/no-existe`)
    await page.getByLabel('Clave de acceso a la API').fill(developerKey)
    await page.getByRole('button', { name: 'Conectar' }).click()

    await expect(page.getByRole('alert')).toContainText(/no como la API de Redmine|no se pudo conectar/i)
  })

  test('el desarrollador entra y ve su nombre y su Redmine', async ({ page }) => {
    await connect(page, developerKey)

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('button', { name: /Cuenta de Dani Desarrollo/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /localhost:3080/ })).toBeVisible()
  })

  test('la sesión sobrevive a recargar', async ({ page }) => {
    await connect(page, developerKey)
    await expect(page).toHaveURL(/\/$/)

    await page.reload()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('button', { name: /Cuenta de Dani Desarrollo/ })).toBeVisible()
  })

  test('con sesión, /connect redirige a la lista', async ({ page }) => {
    await connect(page, developerKey)
    await expect(page).toHaveURL(/\/$/)

    await page.goto('/connect')
    await expect(page).toHaveURL(/\/$/)
  })

  test('desconectar vuelve a conectar y no deja datos en caché', async ({ page }) => {
    await connect(page, developerKey)
    await page.getByRole('button', { name: /Cuenta de Dani Desarrollo/ }).click()
    await page.getByRole('menuitem', { name: 'Desconectar' }).click()

    await expect(page).toHaveURL(/\/connect$/)

    await page.goBack()
    await expect(page).toHaveURL(/\/connect$/)
    await expect(page.getByRole('button', { name: /Cuenta de/ })).toBeHidden()
  })

  test('la clave de API no queda en el navegador', async ({ page }) => {
    await connect(page, developerKey)
    await expect(page).toHaveURL(/\/$/)

    const stored = await page.evaluate(() => JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }))
    expect(stored).not.toContain(developerKey)

    const cookies = await page.context().cookies()
    expect(JSON.stringify(cookies)).not.toContain(developerKey)
    expect(cookies.find(c => c.name === 'nuxt-session')?.httpOnly).toBe(true)
  })
})

test.describe('permisos', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 900, 'Basta con comprobarlo en un ancho')

  test('el desarrollador ve el botón de nueva tarea', async ({ page }) => {
    await connect(page, developerKey)
    await expect(page.getByRole('button', { name: 'Nueva tarea' })).toBeVisible()
  })

  /*
   * El rol Cliente sí tiene `add_issues`, así que hoy ve el mismo botón. Lo que no
   * tiene es `log_time`, y ese control no existe hasta F4: el ocultado por permiso
   * se comprueba ahí (F4-T03) y, a nivel de componente, en tests/unit/can.test.ts.
   */
  test('el cliente entra y ve lo que sí puede hacer', async ({ page }) => {
    await connect(page, clientKey)
    await expect(page).toHaveURL(/\/$/)

    await expect(page.getByRole('button', { name: /Cuenta de Carmen Cliente/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Nueva tarea' })).toBeVisible()
  })
})
