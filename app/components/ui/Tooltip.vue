<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'

/**
 * Tooltip sobre el elemento del slot. Es una ayuda, nunca el único sitio donde
 * vive una información: los botones con solo icono llevan además `aria-label`.
 */
defineProps<{
  /** Texto del tooltip. */
  text: string
  /** Atajo asociado, en notación de UiKbd (`Mod+K`). */
  shortcut?: string
}>()
</script>

<template>
  <TooltipRoot>
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent
        :side-offset="6"
        class="z-50 flex items-center gap-2 rounded-[var(--radius-control)] border border-separator bg-raised px-2 py-1 text-[length:var(--text-caption)] text-content shadow-lg"
      >
        {{ text }}
        <UiKbd
          v-if="shortcut"
          :keys="shortcut"
        />
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
