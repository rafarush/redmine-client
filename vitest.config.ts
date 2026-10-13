import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'happy-dom',
    // El RuleTester de ESLint usa describe/it globales para reportar cada caso.
    globals: true,
    passWithNoTests: true,
  },
})
