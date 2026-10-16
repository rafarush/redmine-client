import type { AiModel } from '../../shared/ai/contract'
import type { Tone } from '../../shared/ai/tones'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { AI_MODELS, DEFAULT_AI_MODEL } from '../../shared/ai/contract'
import { addTone, moveTone, removeTone, sanitizeTones, updateTone, visibleTones } from '../../shared/ai/tones'

const KEY = 'redmine-client:ai'

export type AiProvider = '' | 'api' | 'runner'

/**
 * Preferencias de la IA para escribir (F12): motor, modelos, interruptores y
 * tonos, en `localStorage`. Ningún secreto: la clave de la API vive en la sesión
 * sellada del servidor y el token del runner solo en memoria (se pide al recargar).
 * La Cola de Agente (F11) usa la misma URL y token del runner.
 */
export const useAiStore = defineStore('ai', () => {
  const provider = ref<AiProvider>('')
  const improveModel = ref<AiModel>(DEFAULT_AI_MODEL)
  const completeModel = ref<AiModel>(DEFAULT_AI_MODEL)
  const ghostEnabled = ref(true)
  const suggestEnabled = ref(true)
  const tones = ref<Tone[]>(sanitizeTones(null))
  const runnerUrl = ref('http://127.0.0.1:4317')
  /** Solo en memoria: nunca a `localStorage` (F11-T04). */
  const runnerToken = ref('')

  const model = (value: unknown): AiModel => (AI_MODELS as readonly unknown[]).includes(value) ? value as AiModel : DEFAULT_AI_MODEL

  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Record<string, unknown> | null
    if (raw) {
      provider.value = raw.provider === 'api' || raw.provider === 'runner' ? raw.provider : ''
      improveModel.value = model(raw.improveModel)
      completeModel.value = model(raw.completeModel)
      ghostEnabled.value = raw.ghostEnabled !== false
      suggestEnabled.value = raw.suggestEnabled !== false
      tones.value = sanitizeTones(raw.tones)
      if (typeof raw.runnerUrl === 'string' && /^https?:\/\//.test(raw.runnerUrl)) runnerUrl.value = raw.runnerUrl
    }
  }
  catch {
    // Sin almacenamiento o con datos rotos: valores por defecto.
  }

  watch([provider, improveModel, completeModel, ghostEnabled, suggestEnabled, tones, runnerUrl], () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        provider: provider.value,
        improveModel: improveModel.value,
        completeModel: completeModel.value,
        ghostEnabled: ghostEnabled.value,
        suggestEnabled: suggestEnabled.value,
        tones: tones.value,
        runnerUrl: runnerUrl.value,
      }))
    }
    catch {
      // Ver arriba.
    }
  }, { deep: true })

  const shownTones = computed(() => visibleTones(tones.value))

  return {
    provider,
    improveModel,
    completeModel,
    ghostEnabled,
    suggestEnabled,
    tones,
    shownTones,
    runnerUrl,
    runnerToken,
    addTone: (tone: { name: string, prompt: string }) => {
      tones.value = addTone(tones.value, tone, `tone-${crypto.randomUUID()}`)
    },
    updateTone: (id: string, changes: { name?: string, prompt?: string, hidden?: boolean }) => {
      tones.value = updateTone(tones.value, id, changes)
    },
    removeTone: (id: string) => {
      tones.value = removeTone(tones.value, id)
    },
    moveTone: (id: string, delta: -1 | 1) => {
      tones.value = moveTone(tones.value, id, delta)
    },
  }
})
