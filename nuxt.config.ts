import tailwindcss from '@tailwindcss/vite'

// SPA: el mismo build estático se empaqueta en Tauri (src-tauri, fase F8).
// En web, Nitro sirve además el proxy /api/redmine/** hacia Redmine.
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint', '@nuxt/icon', '@pinia/nuxt', 'nuxt-auth-utils', 'motion-v/nuxt',
    // Las rutas `/_demo/*` (revisión de estados, F2-T09) solo existen en desarrollo.
    (_options, nuxt) => {
      if (nuxt.options.dev) return
      nuxt.hook('pages:extend', (pages) => {
        for (let i = pages.length - 1; i >= 0; i--) {
          if (pages[i]!.path.startsWith('/_demo')) pages.splice(i, 1)
        }
      })
    },
  ],
  ssr: false,
  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      title: 'Redmine Client',
      meta: [{ name: 'color-scheme', content: 'light dark' }],
      // Aplica el tema guardado antes de pintar, para que no parpadee al abrir.
      script: [{
        innerHTML: 'try{var t=localStorage.getItem("redmine-client:theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}',
      }],
    },
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Hosts de Redmine a los que el proxy puede llamar (separados por coma). Evita SSRF.
    redmineAllowedHosts: '',
    // Clave de la API de Anthropic para todo el servidor (F12, opcional): si no hay,
    // cada persona guarda la suya en Ajustes y va en su sesión sellada.
    anthropicApiKey: '',
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
