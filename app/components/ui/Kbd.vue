<script setup lang="ts">
/**
 * Muestra un atajo de teclado. Acepta la notación `Mod+K`, donde `Mod` se
 * resuelve a ⌘ en macOS y a Ctrl en el resto.
 */
const props = defineProps<{ keys: string }>()

const esMac = useIsMac()

const teclas = computed(() =>
  props.keys.split('+').map((tecla) => {
    if (tecla === 'Mod') return esMac ? '⌘' : 'Ctrl'
    if (tecla === 'Shift') return esMac ? '⇧' : 'Shift'
    if (tecla === 'Alt') return esMac ? '⌥' : 'Alt'
    if (tecla === 'Enter') return '↵'
    return tecla
  }),
)

/** Lo que oye un lector de pantalla: los símbolos no se leen bien. */
const descripcion = computed(() =>
  props.keys.replace('Mod', esMac ? 'Comando' : 'Control').split('+').join(' más '),
)
</script>

<template>
  <kbd
    class="data inline-flex items-center gap-0.5 rounded border border-separator px-1 text-[length:var(--text-caption)] text-secondary"
    :aria-label="descripcion"
  >
    <span
      v-for="tecla in teclas"
      :key="tecla"
      aria-hidden="true"
    >{{ tecla }}</span>
  </kbd>
</template>
