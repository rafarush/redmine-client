import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * IA para escribir (F12-T07) con el motor simulado: `/api/ai/*` se responde desde
 * el test, así no hace falta clave ni se gasta nada. Todo pasa en "Nueva tarea",
 * que se descarta al final: Redmine no cambia.
 */

const IMPROVED = 'Se requiere revisar el inicio de sesión con carácter prioritario.'
const GHOST = ' el email ya existe.'

async function mockAi(page: Page, tones: { id: string, name: string, prompt: string }[] = []) {
  const requests: Record<string, unknown>[] = []
  await page.addInitScript((saved) => {
    localStorage.setItem('redmine-client:ai', JSON.stringify(saved))
  }, { provider: 'api', ghostEnabled: true, suggestEnabled: true, tones })
  await page.route('**/api/ai/status', route => route.fulfill({ json: { hasKey: true, source: 'env' } }))
  await page.route('**/api/ai/complete', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    requests.push(body)
    if (body.task === 'improve') return route.fulfill({ json: { kind: 'text', text: IMPROVED } })
    if (body.task === 'continue') return route.fulfill({ json: { kind: 'text', text: GHOST } })
    return route.fulfill({ json: { kind: 'fill', suggestion: { tracker: 'Errores', description: 'Descripción propuesta.', estimated_hours: 3 } } })
  })
  return requests
}

async function openNewIssue(page: Page) {
  await page.goto('/issues')
  await page.getByRole('button', { name: 'Nueva tarea' }).first().click()
  const dialog = page.getByRole('dialog', { name: /Nueva tarea/ })
  await expect(dialog).toBeVisible()
  return dialog
}

async function discard(page: Page) {
  await page.keyboard.press('Escape')
  const confirm = page.getByRole('dialog', { name: '¿Descartar la tarea?' })
  if (await confirm.isVisible().catch(() => false)) await confirm.getByRole('button', { name: 'Descartar' }).click()
}

test.describe('IA para escribir', () => {
  test('crear un tono en Ajustes y verlo en el botón ✦', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 900, 'El menú de cuenta está en la sidebar')
    await mockAi(page)
    await page.goto('/issues')
    await page.getByRole('button', { name: /Cuenta de/ }).click()
    await page.getByRole('menuitem', { name: 'Ajustes' }).click()
    const settings = page.getByRole('dialog', { name: /Ajustes/ })
    await settings.getByRole('tab', { name: 'Inteligencia artificial' }).click()
    await settings.getByLabel('Nombre del nuevo tono').fill('Tono académico')
    await settings.getByLabel('Instrucciones del nuevo tono').fill('Debes usar un tono impersonal, serio y conciso.')
    await settings.getByRole('button', { name: 'Añadir tono' }).click()
    await expect(settings.getByText('Tono académico')).toBeVisible()
    await page.keyboard.press('Escape')

    const dialog = await openNewIssue(page)
    await dialog.getByRole('button', { name: 'Mejorar con IA' }).click()
    await expect(page.getByRole('dialog', { name: 'Mejorar con IA' })).toContainText('Selecciona el texto')
    await page.keyboard.press('Escape')
    await discard(page)
  })

  test('mejorar lo seleccionado con un tono y reemplazarlo, con Deshacer', async ({ page }) => {
    const requests = await mockAi(page, [{ id: 'academic', name: 'Tono académico', prompt: 'Impersonal, serio y conciso.' }])
    const dialog = await openNewIssue(page)
    const description = dialog.getByRole('textbox').nth(1)
    await description.fill('oye el login no va y hay que mirarlo ya')
    await description.press('ControlOrMeta+a')

    await dialog.getByRole('button', { name: 'Mejorar con IA' }).click()
    const popover = page.getByRole('dialog', { name: 'Mejorar con IA' })
    await popover.getByRole('button', { name: 'Tono académico' }).click()
    await expect(popover.getByRole('textbox')).toHaveValue(IMPROVED)
    expect(requests.at(-1)).toMatchObject({ task: 'improve', text: 'oye el login no va y hay que mirarlo ya', instruction: 'Impersonal, serio y conciso.' })

    await popover.getByRole('button', { name: 'Reemplazar' }).click()
    await expect(description).toHaveValue(IMPROVED)
    await page.getByRole('status').filter({ hasText: 'Texto mejorado' }).getByRole('button', { name: 'Deshacer' }).click()
    await expect(description).toHaveValue('oye el login no va y hay que mirarlo ya')
    await discard(page)
  })

  test('texto fantasma: aparece tras una pausa y Tab lo acepta', async ({ page }) => {
    await mockAi(page)
    const dialog = await openNewIssue(page)
    const description = dialog.getByRole('textbox').nth(1)
    await description.click()
    await description.pressSequentially('Al guardar el formulario aparece un error cuando', { delay: 5 })
    await expect(dialog.getByText('Tab', { exact: true })).toBeVisible({ timeout: 5_000 })
    await description.press('Tab')
    await expect(description).toHaveValue(`Al guardar el formulario aparece un error cuando${GHOST}`)
    await discard(page)
  })

  test('sugerir campos a partir del asunto, sin pisar lo escrito', async ({ page }) => {
    await mockAi(page)
    const dialog = await openNewIssue(page)
    await dialog.getByLabel('Asunto').fill('El login falla con tildes')
    const description = dialog.getByRole('textbox').nth(1)
    await description.fill('Lo mío')
    await dialog.getByRole('button', { name: 'Sugerir con IA' }).click()
    const proposal = dialog.getByRole('region', { name: 'Propuesta de la IA' })
    await expect(proposal).toContainText('Descripción propuesta.')
    await proposal.getByRole('button', { name: 'Aplicar todo' }).click()
    await expect(description).toHaveValue('Lo mío')
    await expect(proposal.getByRole('button', { name: 'Reemplazar' })).toBeVisible()
    await discard(page)
  })
})
