import { vCan } from '../directives/can'

/** Registra `v-can` en toda la app (F1-T07). El componente `<Can>` se auto-importa solo. */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('can', vCan)
})
