<script setup lang="ts">
import type { TextFormat } from '../../../shared/redmine/rich-text'
import { renderRichText, resolveFormat } from '../../../shared/redmine/rich-text'

/**
 * Texto de Redmine con formato y saneado (F3-T03). Los `#N` llevan a la tarea
 * dentro de la app sin recargar, igual que las rutas internas (`[[Página]]` de la
 * wiki); los enlaces externos abren otra pestaña.
 */
const props = defineProps<{
  text: string
  /** Retoque del texto antes de renderizar, ya con el formato decidido (p. ej. `[[Página]]`). */
  transform?: (text: string, format: TextFormat) => string
}>()

const preferences = usePreferencesStore()
const html = computed(() => {
  const format = resolveFormat(props.text, preferences.textFormat)
  return renderRichText(props.transform ? props.transform(props.text, format) : props.text, format)
})

function onClick(event: MouseEvent): void {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-issue], a[data-internal]')
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return
  event.preventDefault()
  void navigateTo(link.dataset.issue ? `/issues/${link.dataset.issue}` : link.getAttribute('href')!)
}
</script>

<template>
  <!-- eslint-disable vue/no-v-html -- HTML saneado con DOMPurify en renderRichText. -->
  <div
    class="rich-text break-words leading-relaxed"
    @click="onClick"
    v-html="html"
  />
</template>
