import tailwindcss from '@tailwindcss/vite'

// SPA: el mismo build estático se empaqueta en Tauri (src-tauri, fase F8).
// En web, Nitro sirve además el proxy /api/redmine/** hacia Redmine.
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/icon', '@pinia/nuxt', 'nuxt-auth-utils', 'motion-v/nuxt'],
  ssr: false,
  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      title: 'Redmine Client',
      meta: [{ name: 'color-scheme', content: 'light dark' }],
    },
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Hosts de Redmine a los que el proxy puede llamar (separados por coma). Evita SSRF.
    redmineAllowedHosts: '',
    // NUXT_SESSION_PASSWORD (>= 32 caracteres) lo lee nuxt-auth-utils para sellar la cookie.
  },
  compatibilityDate: '2026-10-01',

  vite: {
    plugins: [tailwindcss()],
  },

  // El formateador de @nuxt/eslint (@stylistic) sustituye a Prettier: una sola herramienta.
  eslint: {
    config: { stylistic: true },
  },

  icon: {
    serverBundle: 'local',
    clientBundle: { scan: true },
  },
})
