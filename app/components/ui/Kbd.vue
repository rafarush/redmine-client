<script setup lang="ts">
/**
 * Muestra un atajo de teclado. Acepta la notación `Mod+K`, donde `Mod` se
 * resuelve a ⌘ en macOS y a Ctrl en el resto.
 */
const props = defineProps<{
  keys: string
  /** Sobre superficie oscura de panel (tooltip, franja de salidas). */
  onBoard?: boolean
}>()

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
    :class="[
      'data inline-flex h-[18px] items-center gap-0.5 rounded-[var(--radius-plate)] border px-1 text-[length:var(--text-caption)] leading-none',
      onBoard ? 'border-board-separator text-on-board-secondary' : 'border-separator bg-raised text-secondary',
    ]"
    :aria-label="description"
  >
    <span
      v-for="key in keyLabels"
      :key="key"
      aria-hidden="true"
    >{{ key }}</span>
  </kbd>
</template>
