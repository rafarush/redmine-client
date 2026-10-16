<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { replaceRange, surrounding } from '../../../shared/ai/editing'

/**
 * "Mejorar con IA" (F12-T04): el botón ✦ junto a un campo de texto largo. Con
 * texto seleccionado, se elige un tono (o se escribe un prompt propio), se ve el
 * antes y el después y "Reemplazar" lo cambia en el campo, con Deshacer. Sin
 * selección, ofrece mejorar todo el texto.
 */
const props = defineProps<{
  /** El campo sobre el que trabaja. */
  target: HTMLTextAreaElement | null | undefined
}>()
const text = defineModel<string>({ required: true })

const ai = useAi()
const toasts = useToastStore()

type Step = 'choose' | 'loading' | 'result' | 'error'
const open = ref(false)
const step = ref<Step>('choose')
const range = ref({ start: 0, end: 0 })
const custom = ref('')
const result = ref('')
const error = ref('')
const lastInstruction = ref('')
let controller: AbortController | undefined

const selected = computed(() => text.value.slice(range.value.start, range.value.end))
const hasSelection = computed(() => selected.value.trim().length > 0)

/** Al abrir se guarda lo seleccionado: el foco se va al popover pero el rango se queda. */
watch(open, (value) => {
  if (value) {
    const el = props.target
    range.value = el ? { start: el.selectionStart, end: el.selectionEnd } : { start: 0, end: 0 }
    step.value = 'choose'
    result.value = ''
    error.value = ''
  }
  else {
    controller?.abort()
  }
})

function useWholeText(): void {
  range.value = { start: 0, end: text.value.length }
}

async function run(instruction: string): Promise<void> {
  if (!hasSelection.value || !instruction.trim()) return
  lastInstruction.value = instruction
  controller?.abort()
  controller = new AbortController()
  step.value = 'loading'
  try {
    const context = range.value.start === 0 && range.value.end === text.value.length ? undefined : surrounding(text.value, range.value.start, range.value.end) || undefined
    result.value = await ai.improve(selected.value, instruction, context, controller.signal)
    step.value = 'result'
  }
  catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') return
    error.value = (e as Error).message
    step.value = 'error'
  }
}

function cancel(): void {
  controller?.abort()
  step.value = 'choose'
}

async function replace(): Promise<void> {
  const before = text.value
  const next = replaceRange(before, range.value.start, range.value.end, result.value)
  text.value = next.text
  open.value = false
  toasts.show('Texto mejorado', { label: 'Deshacer', run: () => {
    text.value = before
  } })
  await nextTick()
  props.target?.focus()
  props.target?.setSelectionRange(next.start, next.end)
}

const CHIP = 'min-h-8 rounded-full border border-separator px-3 text-[length:var(--text-caption)] font-medium transition-colors hover:bg-fill-hover'
</script>

<template>
  <PopoverRoot v-model:open="open">
    <!-- mousedown.prevent: pulsar el botón no quita la selección del campo. -->
    <PopoverTrigger
      aria-label="Mejorar con IA"
      title="Mejorar con IA (selecciona el texto primero)"
      class="inline-flex min-h-[var(--control-min)] min-w-[var(--control-min)] items-center justify-center rounded-[var(--radius-control)] text-secondary transition-colors hover:bg-fill-hover hover:text-content data-[state=open]:bg-fill-selected data-[state=open]:text-content"
      @mousedown.prevent
    >
      <Icon
        name="lucide:sparkle"
        class="size-[18px]"
        aria-hidden="true"
      />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        side="bottom"
        align="end"
        :side-offset="6"
        :collision-padding="12"
        :class="[FLOATING_PANEL, 'flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-3 p-4']"
        aria-label="Mejorar con IA"
        @open-auto-focus.prevent
      >
        <p class="inline-flex items-center gap-1.5 font-semibold">
          <Icon
            name="lucide:sparkle"
            class="size-4"
            aria-hidden="true"
          />
          Mejorar con IA
        </p>

        <!-- Sin motor configurado. -->
        <template v-if="!ai.ready.value">
          <p class="text-secondary">
            {{ ai.notReadyReason.value }}
          </p>
          <UiButton
            label="Configurar IA"
            icon="lucide:settings"
            variant="primary"
            class="self-start"
            @click="open = false; ai.openSettings()"
          />
        </template>

        <!-- Sin selección. -->
        <template v-else-if="!hasSelection">
          <p class="text-secondary">
            Selecciona el texto que quieres mejorar.
          </p>
          <UiButton
            v-if="text.trim()"
            label="Mejorar todo el texto"
            class="self-start"
            @click="useWholeText"
          />
        </template>

        <!-- Elegir tono o prompt. -->
        <template v-else-if="step === 'choose'">
          <p class="line-clamp-2 border-l-2 border-separator pl-2 text-[length:var(--text-caption)] text-secondary">
            {{ selected }}
          </p>
          <div
            role="group"
            aria-label="Tonos"
            class="flex flex-wrap gap-1.5"
          >
            <button
              v-for="tone in ai.store.shownTones"
              :key="tone.id"
              type="button"
              :class="CHIP"
              :title="tone.prompt"
              @click="run(tone.prompt)"
            >
              {{ tone.name }}
            </button>
          </div>
          <form
            class="flex flex-col gap-2"
            @submit.prevent="run(custom)"
          >
            <label class="flex flex-col gap-1">
              <span class="panel-label">Prompt propio</span>
              <textarea
                v-model="custom"
                rows="2"
                placeholder="Por ejemplo: tradúcelo al inglés y hazlo más directo"
                class="min-h-[var(--control-min)] w-full rounded-[var(--radius-control)] border border-separator bg-surface px-2.5 py-2"
                @keydown.enter.exact.prevent="run(custom)"
              />
            </label>
            <UiButton
              type="submit"
              label="Mejorar"
              icon="lucide:sparkle"
              variant="primary"
              class="self-end"
              :disabled="!custom.trim()"
            />
          </form>
        </template>

        <!-- Esperando. -->
        <template v-else-if="step === 'loading'">
          <p
            class="inline-flex items-center gap-2 text-secondary"
            role="status"
          >
            <Icon
              name="lucide:loader"
              class="size-4 motion-safe:animate-spin"
              aria-hidden="true"
            />
            Mejorando…
          </p>
          <UiButton
            label="Cancelar"
            variant="ghost"
            class="self-end"
            @click="cancel"
          />
        </template>

        <!-- Resultado. -->
        <template v-else-if="step === 'result'">
          <div class="flex flex-col gap-1">
            <span class="panel-label">Antes</span>
            <p class="max-h-24 overflow-y-auto whitespace-pre-wrap text-[length:var(--text-caption)] text-secondary line-through decoration-separator">
              {{ selected }}
            </p>
          </div>
          <label class="flex flex-col gap-1">
            <span class="panel-label">Después (puedes retocarlo)</span>
            <textarea
              v-model="result"
              rows="5"
              class="w-full rounded-[var(--radius-control)] border border-separator bg-surface px-2.5 py-2"
            />
          </label>
          <div class="flex flex-wrap justify-end gap-2">
            <UiButton
              label="Otro tono"
              variant="ghost"
              @click="step = 'choose'"
            />
            <UiButton
              label="Repetir"
              icon="lucide:rotate-cw"
              variant="ghost"
              @click="run(lastInstruction)"
            />
            <UiButton
              label="Reemplazar"
              variant="primary"
              :disabled="!result.trim()"
              @click="replace"
            />
          </div>
        </template>

        <!-- Error. -->
        <template v-else>
          <p
            role="alert"
            class="inline-flex items-start gap-1.5 text-warning"
          >
            <Icon
              name="lucide:circle-alert"
              class="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            {{ error }}
          </p>
          <div class="flex justify-end gap-2">
            <UiButton
              label="Volver"
              variant="ghost"
              @click="step = 'choose'"
            />
            <UiButton
              label="Reintentar"
              icon="lucide:rotate-cw"
              @click="run(lastInstruction)"
            />
          </div>
        </template>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
