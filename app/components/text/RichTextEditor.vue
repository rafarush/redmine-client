<script setup lang="ts">
import type { Markup } from '../../../shared/redmine/rich-text'
import { applyMarkup, resolveFormat } from '../../../shared/redmine/rich-text'

/**
 * Editor de texto de Redmine (F3-T03): un textarea con pestañas Escribir / Vista
 * previa y tres atajos (negrita, lista, código) que escriben la sintaxis del
 * formato detectado o elegido en Preferencias. Ctrl/⌘+Enter guarda; Esc cancela.
 */
withDefaults(defineProps<{
  label: string
  saving?: boolean
  /** Verbo del botón: "Guardar descripción", "Guardar página"… */
  saveLabel?: string
}>(), { saveLabel: 'Guardar' })

const emit = defineEmits<{ save: [], cancel: [] }>()
const text = defineModel<string>({ required: true })

const preferences = usePreferencesStore()
const format = computed(() => resolveFormat(text.value, preferences.textFormat))
const tab = ref<'write' | 'preview'>('write')
const ghostArea = useTemplateRef<{ el: HTMLTextAreaElement | null }>('ghostArea')
/** El textarea de dentro del campo con texto fantasma (F12). */
const area = computed(() => ghostArea.value?.el ?? null)

onMounted(() => area.value?.focus())

async function markup(kind: Markup): Promise<void> {
  const el = area.value
  if (!el) return
  const result = applyMarkup(text.value, el.selectionStart, el.selectionEnd, kind, format.value)
  text.value = result.text
  await nextTick()
  el.focus()
  el.setSelectionRange(result.start, result.end)
}

function onKeydown(event: KeyboardEvent): void {
  const mod = event.ctrlKey || event.metaKey
  if (mod && event.key === 'Enter') {
    event.preventDefault()
    emit('save')
  }
  else if (mod && event.key.toLowerCase() === 'b') {
    event.preventDefault()
    void markup('bold')
  }
  else if (event.key === 'Escape') {
    event.preventDefault()
    emit('cancel')
  }
}

const TAB = 'min-h-8 rounded-[var(--radius-control)] px-2.5 text-[length:var(--text-caption)] font-medium text-secondary aria-selected:bg-fill-selected aria-selected:text-content'
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center gap-1">
      <div
        role="tablist"
        :aria-label="label"
        class="flex gap-1"
      >
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'write'"
          :class="TAB"
          @click="tab = 'write'"
        >
          Escribir
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'preview'"
          :class="TAB"
          @click="tab = 'preview'"
        >
          Vista previa
        </button>
      </div>
      <div
        v-if="tab === 'write'"
        class="ml-auto flex items-center gap-0.5"
        role="toolbar"
        aria-label="Formato"
      >
        <AiImproveButton
          v-model="text"
          :target="area"
        />
        <UiButton
          label="Negrita"
          icon="lucide:bold"
          icon-only
          variant="ghost"
          shortcut="Mod+B"
          @click="markup('bold')"
        />
        <UiButton
          label="Lista"
          icon="lucide:list"
          icon-only
          variant="ghost"
          @click="markup('list')"
        />
        <UiButton
          label="Código"
          icon="lucide:code"
          icon-only
          variant="ghost"
          @click="markup('code')"
        />
        <span class="pl-1 text-[length:var(--text-caption)] text-tertiary">{{ format === 'markdown' ? 'Markdown' : 'Textile' }}</span>
      </div>
    </div>

    <AiGhostTextarea
      v-show="tab === 'write'"
      ref="ghostArea"
      v-model="text"
      rows="8"
      :aria-label="label"
      class="data min-h-40 w-full resize-y rounded-[var(--radius-control)] border border-separator bg-surface px-3 py-2 text-[length:var(--text-body)]"
      @keydown="onKeydown"
    />
    <div
      v-if="tab === 'preview'"
      class="min-h-40 rounded-[var(--radius-control)] border border-separator px-3 py-2"
    >
      <TextRichText
        v-if="text.trim()"
        :text="text"
      />
      <p
        v-else
        class="text-secondary"
      >
        Nada que previsualizar.
      </p>
    </div>

    <div class="flex items-center justify-end gap-2">
      <UiButton
        label="Cancelar"
        variant="ghost"
        @click="emit('cancel')"
      />
      <UiButton
        :label="saving ? 'Guardando…' : saveLabel"
        variant="primary"
        :disabled="saving"
        @click="emit('save')"
      />
    </div>
  </div>
</template>
