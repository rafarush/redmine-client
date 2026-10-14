<script setup lang="ts">
/**
 * Muestra un atajo de teclado. Acepta la notación `Mod+K`, donde `Mod` se
 * resuelve a ⌘ en macOS y a Ctrl en el resto.
 */
const props = defineProps<{ keys: string }>()

const isMac = useIsMac()

const keyLabels = computed(() =>
  props.keys.split('+').map((key) => {
    if (key === 'Mod') return isMac ? '⌘' : 'Ctrl'
    if (key === 'Shift') return isMac ? '⇧' : 'Shift'
    if (key === 'Alt') return isMac ? '⌥' : 'Alt'
    if (key === 'Enter') return '↵'
    return key
  }),
)

/** Lo que oye un lector de pantalla: los símbolos no se leen bien. */
const description = computed(() =>
  props.keys.replace('Mod', isMac ? 'Comando' : 'Control').split('+').join(' más '),
)
</script>

<template>
  <kbd
    class="data inline-flex items-center gap-0.5 rounded border border-separator px-1 text-[length:var(--text-caption)] text-secondary"
    :aria-label="description"
  >
    <span
      v-for="key in keyLabels"
      :key="key"
      aria-hidden="true"
    >{{ key }}</span>
  </kbd>
</template>
