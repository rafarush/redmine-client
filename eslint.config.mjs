// @ts-check
import css from '@eslint/css'
import withNuxt from './.nuxt/eslint.config.mjs'
import noRawHexColor from './eslint-rules/no-raw-hex-color.mjs'

/** Reglas propias del proyecto. Ver eslint-rules/ y sdd/02-diseno.md. */
const design = {
  rules: { 'no-raw-hex-color': noRawHexColor },
}

const SCRIPT_FILES = ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue}']

const nuxtConfigs = await withNuxt({
  ignores: ['.nuxt/**', '.output/**', 'dist/**', 'src-tauri/**', 'playwright-report/**', 'test-results/**'],
})

/*
 * El preset de Nuxt deja varios bloques sin `files`, así que sus reglas y su parser de JS
 * alcanzarían también a los .css y harían fallar a ESLint. Los acotamos a código.
 * Los bloques que solo declaran `ignores` son ignorados globales y se dejan intactos.
 */
const scoped = nuxtConfigs.map((config) => {
  if (config.files) return config
  const keys = Object.keys(config).filter(k => k !== 'ignores' && k !== 'name')
  return keys.length ? { ...config, files: SCRIPT_FILES } : config
})

export default [
  ...scoped,

  // Colores solo desde tokens, en código de la app.
  {
    name: 'redmine-client/design-tokens',
    files: ['app/**/*.{vue,ts,js}', 'shared/**/*.ts', 'server/**/*.ts'],
    plugins: { design },
    rules: { 'design/no-raw-hex-color': 'error' },
  },

  // Archivos .css: misma regla, salvo tokens.css, que es donde viven los colores.
  {
    name: 'redmine-client/css',
    files: ['**/*.css'],
    ignores: ['app/assets/css/tokens.css'],
    language: 'css/css',
    languageOptions: { tolerant: true },
    plugins: { css, design },
    rules: { 'design/no-raw-hex-color': 'error' },
  },

  // Scripts y tests: pueden escribir en consola.
  {
    name: 'redmine-client/tests',
    files: ['tests/**/*.ts', 'scripts/**/*.{ts,mjs}'],
    rules: { 'no-console': 'off' },
  },
]
