<script setup lang="ts">
import type { ShortcutId } from '../../../../shared/shortcuts/keymap'
import {
  comboFromEvent,
  DEFAULT_SHORTCUTS,
  findConflict,
  isBrowserReserved,
  isValidCombo,
  SHORTCUT_IDS,
} from '../../../../shared/shortcuts/keymap'

/**
 * Atajos de teclado (F2c-T12). "Cambiar" graba la siguiente combinación; Esc cancela.
 * El cambio se guarda al momento. Mientras se graba, los atajos de la app se silencian.
 */
const shortcuts = useShortcutsStore()
const toasts = useToastStore()

const ROWS: Record<ShortcutId, { label: string, hint: string }> = {
  newIssue: { label: 'Nueva tarea', hint: 'En toda la app.' },
  addBoard: { label: 'Nuevo board', hint: 'Solo en el workspace.' },
  toggleGrid: { label: 'Bloquear o desbloquear la rejilla', hint: 'Solo en el workspace.' },
}
const CONFLICT_NAMES: Record<ShortcutId, string> = {
  newIssue: 'Nueva tarea',
  addBoard: 'Nuevo board',
  toggleGrid: 'Bloquear o desbloquear la rejilla',
}

const recording = ref<ShortcutId | null>(null)
const error = ref<{ id: ShortcutId, text: string } | null>(null)

function onKey(event: KeyboardEvent): void {
  const id = recording.value
  if (!id) return
  // Todo lo pulsado mientras se graba es para el atajo, no para el diálogo.
  event.preventDefault()
  event.stopPropagation()
  if (event.key === 'Escape') return stop()

  const combo = comboFromEvent(event)
  if (!combo) return // solo un modificador: se espera la tecla
  if (!isValidCombo(combo)) {
    error.value = { id, text: 'Usa Ctrl o Alt junto con otra tecla.' }
    return
  }
  const conflict = findConflict(shortcuts.bindings, id, combo)
  if (conflict) {
    error.value = { id, text: conflict === 'fixed' ? 'Esa combinación ya la usa la app.' : `Ya es el atajo de "${CONFLICT_NAMES[conflict]}".` }
    return
  }
  shortcuts.setBinding(id, combo)
  toasts.show('Atajo cambiado')
  stop()
}

function start(id: ShortcutId): void {
  stop()
  recording.value = id
  error.value = null
  shortcuts.capturing = true
  window.addEventListener('keydown', onKey, true)
}

function stop(): void {
  recording.value = null
  shortcuts.capturing = false
  window.removeEventListener('keydown', onKey, true)
}

onBeforeUnmount(stop)

const isDefault = (id: ShortcutId) => shortcuts.bindings[id] === DEFAULT_SHORTCUTS[id]
const changed = computed(() => SHORTCUT_IDS.some(id => !isDefault(id)))
</script>

<template>
  <section aria-labelledby="settings-shortcuts-title">
    <h3
      id="settings-shortcuts-title"
      class="font-semibold"
    >
      Atajos de teclado
    </h3>
    <p class="mt-0.5 text-secondary">
      Elige la combinación de cada acción.
    </p>

    <ul class="mt-3 flex flex-col">
      <li
        v-for="id in SHORTCUT_IDS"
        :key="id"
        class="-mx-2 flex flex-col gap-0.5 rounded-[var(--radius-plate)] px-2 py-1.5 odd:bg-fill-alt"
      >
        <div class="flex min-h-[var(--control-min)] items-center gap-3">
          <div class="min-w-0 flex-1">
            <p>{{ ROWS[id].label }}</p>
            <p class="text-[length:var(--text-caption)] text-secondary">
              {{ ROWS[id].hint }}
            </p>
          </div>
          <span
            v-if="recording === id"
            class="text-secondary"
            role="status"
          >Pulsa la combinación…</span>
          <UiKbd
            v-else
            :keys="shortcuts.bindings[id]"
          />
          <UiButton
            :label="recording === id ? 'Cancelar' : 'Cambiar'"
            variant="ghost"
            :aria-label="recording === id ? `Cancelar el cambio de ${ROWS[id].label}` : `Cambiar el atajo de ${ROWS[id].label}`"
            @click="recording === id ? stop() : start(id)"
          />
          <UiButton
            label="Restablecer"
            icon="lucide:rotate-ccw"
            icon-only
            variant="ghost"
            :disabled="isDefault(id)"
            @click="shortcuts.resetBinding(id)"
          />
        </div>
        <p
          v-if="error?.id === id"
          role="alert"
          class="flex items-center gap-1.5 text-[length:var(--text-caption)] text-content"
        >
          <Icon
            name="lucide:triangle-alert"
            class="size-3.5 shrink-0"
            aria-hidden="true"
          />
          {{ error.text }}
        </p>
        <p
          v-else-if="isBrowserReserved(shortcuts.bindings[id])"
          class="flex items-center gap-1.5 text-[length:var(--text-caption)] text-secondary"
        >
          <Icon
            name="lucide:info"
            class="size-3.5 shrink-0"
            aria-hidden="true"
          />
          El navegador puede quedarse esta combinación; en la app de escritorio sí funciona.
        </p>
      </li>
    </ul>

    <div class="mt-4 flex justify-end">
      <UiButton
        label="Restablecer todos"
        icon="lucide:rotate-ccw"
        variant="ghost"
        :disabled="!changed"
        @click="shortcuts.resetAll()"
      />
    </div>
  </section>
</template>
