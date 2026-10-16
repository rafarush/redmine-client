<script setup lang="ts">
import { renderRichText, resolveFormat } from '../../../shared/redmine/rich-text'

/**
 * Texto de Redmine con formato y saneado (F3-T03). Los `#N` llevan a la tarea
 * dentro de la app sin recargar; los enlaces externos abren otra pestaña.
 */
const props = defineProps<{ text: string }>()

const preferences = usePreferencesStore()
const html = computed(() => renderRichText(props.text, resolveFormat(props.text, preferences.textFormat)))

function onClick(event: MouseEvent): void {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-issue]')
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return
  event.preventDefault()
  void navigateTo(`/issues/${link.dataset.issue}`)
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
