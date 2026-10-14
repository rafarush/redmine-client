import type { Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'

/** Utilidades compartidas por los e2e que necesitan el Redmine local. */

export const REDMINE_URL = 'http://localhost:3080'

/** Estado de sesión que reutilizan los tests que no prueban el propio login. */
export const SESSION_STATE = 'tests/e2e/.auth/desarrollador.json'

export function apiKeyFor(login: string): string {
  return execFileSync(
    'docker',
    ['compose', '-f', 'docker/compose.dev.yml', 'exec', '-T', 'redmine', 'bundle', 'exec', 'rails', 'runner',
      `puts User.find_by_login("${login}").api_key`],
    // Sin stderr: el contenedor escupe avisos de gems que no aportan nada aquí.
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  ).trim()
}

export async function connect(page: Page, apiKey: string, url = REDMINE_URL): Promise<void> {
  await page.goto('/connect')
  await page.getByLabel('Dirección de Redmine').fill(url)
  await page.getByLabel('Clave de acceso a la API').fill(apiKey)
  await page.getByRole('button', { name: 'Conectar' }).click()
}
