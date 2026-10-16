<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'

/**
 * Diálogo pequeño (ajustar tiempo, ajustes del workspace). Un solo modal a la vez
 * (sdd/02-diseno.md): velo único `scrim`, Esc cierra y el foco vuelve al disparador.
 */
withDefaults(defineProps<{
  title: string
  /** Frase corta bajo el título; también es la descripción accesible. */
  description?: string
  /** Ancho máximo en rem. */
  width?: number
}>(), { width: 24 })

const open = defineModel<boolean>('open', { default: false })

/** Pulsar "Deshacer" en un aviso no es salir del diálogo: no lo cierra. */
function keepForToasts(event: Event): void {
  const target = event.target as Element | null
  if (target?.closest?.('[data-toasts]')) event.preventDefault()
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <slot name="trigger" />
    <DialogPortal>
      <DialogOverlay :class="SCRIM" />
      <DialogContent
        :class="[DIALOG_PANEL, 'top-[18vh] flex max-h-[70vh] flex-col']"
        :style="{ width: `min(${width}rem, calc(100vw - 2rem))` }"
        @interact-outside="keepForToasts"
      >
        <header class="flex items-start gap-3 px-5 pb-2 pt-4">
          <div class="min-w-0 flex-1">
            <DialogTitle class="text-[length:var(--text-title)] font-semibold">
              {{ title }}
            </DialogTitle>
            <DialogDescription
              v-if="description"
              class="mt-0.5 text-secondary"
            >
              {{ description }}
            </DialogDescription>
          </div>
          <DialogClose as-child>
            <UiButton
              label="Cerrar"
              icon="lucide:x"
              icon-only
              variant="ghost"
            />
          </DialogClose>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          <slot />
        </div>
        <footer
          v-if="$slots.footer"
          class="flex justify-end gap-2 border-t border-separator px-5 py-3"
        >
          <slot name="footer" />
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
