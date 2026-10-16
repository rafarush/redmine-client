import type { Page, Route } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * Cola de Agente (F11-T08) con un runner falso: `/health`, `/tasks` y `/events` se
 * responden desde el test. Sin mapeo de estados, así Redmine no cambia.
 *
 * Ojo: el token del runner solo vive en memoria, así que tras configurarlo se navega
 * dentro de la app, sin `page.goto` (que recarga).
 */

const RUNNER = 'http://127.0.0.1:4317'
const PR = 'https://github.com/org/repo/pull/99'

async function fakeRunner(page: Page) {
  const state = { taskId: '' as string, delivered: false, tasks: [] as Record<string, unknown>[] }
  const cors = (route: Route) => ({
    'access-control-allow-origin': route.request().headers().origin ?? '*',
    'access-control-allow-headers': 'authorization, content-type, last-event-id',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  })
  await page.route(`${RUNNER}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const headers = cors(route)
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (request.headers().authorization !== 'Bearer tok') return route.fulfill({ status: 401, headers, json: { error: 'unauthorized' } })
    // Ocupado mientras tiene la tarea sin terminar, como el runner de verdad.
    if (url.pathname === '/health') return route.fulfill({ headers, json: { ok: true, busy: !!state.taskId && !state.delivered } })
    if (url.pathname === '/tasks' && request.method() === 'POST') {
      const task = request.postDataJSON() as Record<string, unknown>
      state.tasks.push(task)
      state.taskId = String(task.id)
      return route.fulfill({ status: 202, headers, json: { id: task.id } })
    }
    if (url.pathname === '/events') {
      // Una conexión que entrega lo que haya y se cierra: la app reconecta sola.
      let body = ': ping\n\n'
      if (state.taskId && !state.delivered) {
        state.delivered = true
        const events = [
          { id: 1, taskId: state.taskId, type: 'log', line: 'Leyendo el código' },
          { id: 2, taskId: state.taskId, type: 'phase', phase: 'testing', branch: 'agent/1-prueba' },
          { id: 3, taskId: state.taskId, type: 'phase', phase: 'pr_opened', branch: 'agent/1-prueba', prUrl: PR },
        ]
        body = events.map(e => `id: ${e.id}\nevent: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('')
      }
      return route.fulfill({ headers: { ...headers, 'content-type': 'text/event-stream' }, body })
    }
    return route.fulfill({ status: 404, headers, json: { error: 'not_found' } })
  })
  return state
}

const navLink = (page: Page, name: string) => page.getByRole('link', { name, exact: true }).filter({ visible: true }).first()

test.describe('cola de agente', () => {
  test('sin agente configurado ofrece configurarlo', async ({ page }) => {
    await page.goto('/agent')
    await page.getByRole('button', { name: 'Configurar agente' }).click()
    await expect(page.getByRole('dialog', { name: 'Integraciones IA' })).toBeVisible()
  })

  test('con un runner falso: encolar, ver las fases y el enlace a la PR', async ({ page }) => {
    const runner = await fakeRunner(page)
    await page.goto('/agent')

    // Configurar y probar la conexión.
    await page.getByRole('button', { name: 'Configurar agente' }).click()
    const dialog = page.getByRole('dialog', { name: 'Integraciones IA' })
    await dialog.getByLabel('Token').fill('malo')
    await dialog.getByRole('button', { name: 'Probar conexión' }).click()
    await expect(dialog.getByRole('status')).toContainText('no es válido')
    await dialog.getByLabel('Token').fill('tok')
    await dialog.getByRole('button', { name: 'Probar conexión' }).click()
    await expect(dialog.getByRole('status')).toContainText('Conectado')
    await dialog.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Runner conectado')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Pausar cola' }).click()

    // Añadir una tarea desde el menú de la lista.
    await navLink(page, 'Tareas').click()
    const row = page.getByRole('grid', { name: 'Tareas' }).getByRole('row').nth(1)
    await row.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Añadir a la cola del agente' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'añadida a la cola del agente' })).toBeVisible()

    // En la cola: pendiente; al reanudar, el runner la recibe y llegan las fases.
    await navLink(page, page.viewportSize()!.width < 900 ? 'Agente' : 'Cola de Agente').click()
    await expect(page.getByText('En cola')).toBeVisible()
    await page.getByRole('button', { name: 'Reanudar cola' }).click()
    await expect.poll(() => runner.tasks.length, { timeout: 15_000 }).toBe(1)
    expect(runner.tasks[0]).toMatchObject({ baseBranch: 'main' })
    expect(typeof runner.tasks[0]!.title).toBe('string')

    await expect(page.getByText('PR abierta')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('link', { name: 'Ver PR' })).toHaveAttribute('href', PR)
    await page.getByRole('button', { name: 'Ver log' }).click()
    await expect(page.getByLabel('Log del agente')).toContainText('Leyendo el código')

    // El token no se guarda en el navegador.
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }))
    expect(stored).not.toContain('tok"')
    expect(stored).not.toContain('"tok')
  })
})
