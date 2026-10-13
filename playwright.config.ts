import { defineConfig, devices } from '@playwright/test'

const PORT = 3124
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
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
    { name: 'regular', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'compacto', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 700 } } },
  ],

  // Reutiliza un `pnpm dev` ya abierto; si no hay ninguno, levanta uno.
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
