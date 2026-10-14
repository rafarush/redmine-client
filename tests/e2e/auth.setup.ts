import { expect, test as setup } from '@playwright/test'
import { apiKeyFor, connect, SESSION_STATE } from './_session'

/**
 * Inicia sesión una vez y guarda la cookie para el resto de los e2e.
 * Los tests del propio login no usan este estado: lo anulan en su archivo.
 */
setup('iniciar sesión como desarrollador', async ({ page }) => {
  const key = apiKeyFor('desarrollador')
  expect(key, 'Falta el Redmine local: docker compose up -d && pnpm seed').toMatch(/^[0-9a-f]{40}$/)

  await connect(page, key)
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: /Cuenta de Dani Desarrollo/ })).toBeVisible()

  await page.context().storageState({ path: SESSION_STATE })
})
