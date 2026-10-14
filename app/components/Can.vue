<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '../stores/session'
import { DENIED_REASON } from '../utils/can'

/**
 * Muestra su contenido solo si el usuario tiene el permiso (F1-T07).
 *
 * Por defecto **oculta** lo que no se puede hacer, en vez de deshabilitarlo
 * (sdd/00-vision.md › Simplicity). Con `mode="disabled"` lo deja visible y
 * apagado, para los casos donde esconderlo confundiría más que ayudar: el slot
 * recibe `{ allowed, reason }` para pintarlo.
 */
const props = withDefaults(defineProps<{
  /** Permiso de Redmine, p. ej. `log_time`. */
  permission: string
  /** Proyecto donde se comprueba. Sin él, basta con poder en alguno. */
  project?: number
  mode?: 'hidden' | 'disabled'
}>(), { mode: 'hidden' })

const session = useSessionStore()

const allowed = computed(() => session.can(props.permission, props.project))
const reason = computed(() => allowed.value ? '' : DENIED_REASON)
</script>

<template>
  <slot
    v-if="allowed || mode === 'disabled'"
    :allowed="allowed"
    :reason="reason"
  />
</template>
