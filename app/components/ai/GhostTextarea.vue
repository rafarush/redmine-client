<script setup lang="ts">
import { cleanGhost, shouldRequestGhost } from '../../../shared/ai/editing'

/**
 * Textarea con texto fantasma (F12-T05): tras una pausa al escribir con el cursor
 * al final, la IA propone cómo seguir y se pinta en gris detrás del cursor. Tab lo
 * acepta; Esc o seguir escribiendo lo descarta. Sin IA lista o con el interruptor
 * apagado es un textarea normal y no hace ninguna petición.
 *
 * Sustituye a `<textarea>` tal cual: clases, atributos y eventos pasan al textarea
 * (el espejo copia sus medidas reales), y `el` expone el elemento (para el botón ✦
 * o los atajos de formato).
 */
defineOptions({ inheritAttrs: false })
withDefaults(defineProps<{
  /** Clases del envoltorio (para el layout: `w-full`, `flex-1`…); las visuales van al textarea. */
  wrapperClass?: string
}>(), { wrapperClass: 'w-full' })
const text = defineModel<string>({ required: true })
const attrs = useAttrs()

const ai = useAi()
const area = useTemplateRef<HTMLTextAreaElement>('area')
const mirror = useTemplateRef<HTMLDivElement>('mirror')
defineExpose({ el: area })

const ghost = ref('')
const PAUSE_MS = 700
let timer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined

const enabled = computed(() => ai.store.ghostEnabled && ai.ready.value)

function clear(): void {
  clearTimeout(timer)
  controller?.abort()
  controller = undefined
  ghost.value = ''
}

/** Copia del textarea lo que decide dónde cae cada letra, para que el espejo coincida. */
const MIRRORED = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'textIndent', 'tabSize'] as const
function syncMirror(): void {
  const el = area.value
  const box = mirror.value
  if (!el || !box) return
  const style = getComputedStyle(el)
  for (const key of MIRRORED) box.style[key] = style[key]
  box.scrollTop = el.scrollTop
}

function schedule(): void {
  clear()
  const el = area.value
  if (!enabled.value || !el) return
  timer = setTimeout(async () => {
    const before = text.value
    if (!shouldRequestGhost(before, el.selectionStart, el.selectionEnd) || document.activeElement !== el) return
    controller = new AbortController()
    const own = controller
    try {
      const raw = await ai.continueText(before, own.signal)
      // Una respuesta vieja nunca pisa: si algo cambió mientras pensaba, se tira.
      if (own !== controller || text.value !== before || el.selectionEnd !== before.length) return
      ghost.value = cleanGhost(before, raw)
      await nextTick()
      syncMirror()
    }
    catch {
      // El autocompletado es un extra: si falla, simplemente no aparece.
    }
  }, PAUSE_MS)
}

function forward(name: 'onKeydown' | 'onInput', event: Event): void {
  const handler = attrs[name] as ((e: Event) => void) | ((e: Event) => void)[] | undefined
  if (Array.isArray(handler)) handler.forEach(h => h(event))
  else handler?.(event)
}

async function onKeydown(event: KeyboardEvent): Promise<void> {
  if (ghost.value && event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault()
    const accepted = ghost.value
    clear()
    text.value += accepted
    await nextTick()
    const el = area.value
    el?.setSelectionRange(text.value.length, text.value.length)
    return
  }
  if (ghost.value && event.key === 'Escape') {
    // Solo descarta la sugerencia: no cierra el editor ni el diálogo.
    event.preventDefault()
    event.stopPropagation()
    clear()
    return
  }
  forward('onKeydown', event)
}

function onInput(event: Event): void {
  forward('onInput', event)
  schedule()
}

watch(enabled, (on) => {
  if (!on) clear()
})
onBeforeUnmount(clear)

const passthrough = computed(() => {
  const { onKeydown: _k, onInput: _i, class: _c, style: _s, ...rest } = attrs
  return rest
})
</script>

<template>
  <div
    class="relative"
    :class="wrapperClass"
    data-ghost-wrapper
  >
    <textarea
      ref="area"
      v-model="text"
      v-bind="passthrough"
      :class="[attrs.class as string, 'block']"
      :style="attrs.style as string"
      :aria-describedby="ghost ? 'ghost-hint' : (passthrough['aria-describedby'] as string | undefined)"
      @keydown="onKeydown"
      @input="onInput"
      @click="clear"
      @blur="clear"
      @scroll="syncMirror"
    />
    <div
      v-if="ghost"
      ref="mirror"
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words border-transparent"
      style="border-style: solid"
    >
      <span class="invisible">{{ text }}</span><span class="text-tertiary">{{ ghost }}</span><span class="ml-1 rounded-[var(--radius-plate)] border border-separator px-1 align-middle text-[10px] text-tertiary">Tab</span>
    </div>
    <span
      v-if="ghost"
      id="ghost-hint"
      class="sr-only"
      aria-live="polite"
    >Sugerencia: {{ ghost }}. Pulsa Tab para aceptarla.</span>
  </div>
</template>
