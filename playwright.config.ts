import { defineConfig, devices } from '@playwright/test'
import { SESSION_STATE } from './tests/e2e/_session'

const PORT = 3124

/*
 * IP explícita, no `localhost`: en Windows `nuxt dev` escucha solo en `[::1]` y
 * Chromium resuelve `localhost` a 127.0.0.1, así que la mitad de las pruebas
 * caían con ERR_CONNECTION_REFUSED. Fijar el host en los dos lados lo evita.
 */
const HOST = '127.0.0.1'
const BASE_URL = `http://${HOST}:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Con más workers el dev server compila varias rutas a la vez y los tests se agotan por timeout.
  workers: process.env.CI ? 2 : 3,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',

  // El servidor de desarrollo compila cada ruta la primera vez que se pide, así que
  // la carga inicial tarda bastante más que las siguientes.
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // El Chromium completo en modo headless nuevo, en vez del headless shell:
    // un binario menos que descargar y se comporta como el navegador real.
    channel: 'chromium',
  },

  projects: [
    // Inicia sesión una vez; los demás proyectos reutilizan la cookie.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'regular',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, storageState: SESSION_STATE },
    },
    {
      name: 'compact',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 700 }, storageState: SESSION_STATE },
    },
  ],

  // Reutiliza un `pnpm dev` ya abierto; si no hay ninguno, levanta uno.
  webServer: {
    command: `pnpm dev --host ${HOST} --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
