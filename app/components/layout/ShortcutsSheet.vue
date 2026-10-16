<script setup lang="ts">
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'

/** Hoja de atajos (`?`): lo que la lista permite hacer sin ratón, en un solo sitio. */
const ui = useUiStore()

const GROUPS = [
  {
    title: 'En la lista',
    items: [
      { label: 'Siguiente tarea', keys: ['J'] },
      { label: 'Tarea anterior', keys: ['K'] },
      { label: 'Abrir la tarea', keys: ['Enter'] },
      { label: 'Menú de la tarea', keys: ['Shift', 'F10'] },
    ],
  },
  {
    title: 'En el workspace (tarea enfocada)',
    items: [
      { label: 'Empezar o completar', keys: ['Enter'] },
      { label: 'Pausar o reanudar el cronómetro', keys: ['P'] },
      { label: 'Parar y registrar el tiempo', keys: ['S'] },
      { label: 'Ajustar el tiempo', keys: ['T'] },
      { label: 'Subir o bajar la prioridad', keys: ['Alt', '↑↓'] },
    ],
  },
  {
    title: 'En toda la app',
    items: [
      { label: 'Buscar', keys: ['Mod', 'K'] },
      { label: 'Mostrar u ocultar las secciones', keys: ['Mod', '\\'] },
      { label: 'Ver esta hoja', keys: ['?'] },
    ],
  },
]
</script>

<template>
  <DialogRoot v-model:open="ui.shortcutsOpen">
    <DialogPortal>
      <DialogOverlay class="ui-scrim fixed inset-0 z-40 bg-scrim" />
      <DialogContent
        class="ui-dialog fixed left-1/2 top-[15vh] z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 rounded-[var(--radius-surface)] border border-separator bg-raised px-5 pb-4 pt-4 shadow-dialog"
      >
        <DialogTitle class="text-[length:var(--text-title)] font-semibold text-content">
          Atajos de teclado
        </DialogTitle>
        <DialogDescription class="sr-only">
          Teclas para moverse por la lista y por la app.
        </DialogDescription>

        <section
          v-for="group in GROUPS"
          :key="group.title"
          class="mt-4"
        >
          <h3 class="panel-label">
            {{ group.title }}
          </h3>
          <dl class="mt-1">
            <div
              v-for="item in group.items"
              :key="item.label"
              class="-mx-2 flex min-h-[var(--control-min)] items-center justify-between gap-4 rounded-[var(--radius-plate)] px-2 text-[length:var(--text-body)] odd:bg-fill-alt"
            >
              <dt>{{ item.label }}</dt>
              <dd>
                <UiKbd :keys="item.keys.join('+')" />
              </dd>
            </div>
          </dl>
        </section>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
