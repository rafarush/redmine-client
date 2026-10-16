<script setup lang="ts">
import type { AiModel } from '../../../../shared/ai/contract'
import type { AiProvider } from '../../../stores/ai'
import { AI_MODEL_LABELS, AI_MODELS } from '../../../../shared/ai/contract'
import { MAX_TONE_NAME, MAX_TONE_PROMPT } from '../../../../shared/ai/tones'

/**
 * Inteligencia artificial (F12-T03): con qué motor se habla (API de Anthropic o
 * runner local con Claude Code), qué modelo usa cada función, los interruptores
 * de los autocompletados y los tonos de "Mejorar con IA".
 */
const ai = useAi()
const store = ai.store
const toasts = useToastStore()

const PROVIDERS: ReadonlyArray<{ value: AiProvider, label: string }> = [
  { value: '', label: 'Sin IA' },
  { value: 'api', label: 'API de Anthropic' },
  { value: 'runner', label: 'Runner local (Claude Code)' },
]
const MODEL_OPTIONS = AI_MODELS.map(id => ({ value: id, label: AI_MODEL_LABELS[id] }))

// ---------------------------------------------------------------- conexión

const keyDraft = ref('')
const busy = ref(false)
const testResult = ref<{ ok: boolean, text: string } | null>(null)

async function saveKey(): Promise<void> {
  if (!keyDraft.value.trim() || busy.value) return
  busy.value = true
  testResult.value = null
  try {
    await ai.saveKey(keyDraft.value.trim())
    keyDraft.value = ''
    testResult.value = { ok: true, text: 'Clave guardada y comprobada.' }
  }
  catch (error) {
    testResult.value = { ok: false, text: (error as Error).message }
  }
  finally {
    busy.value = false
  }
}

async function removeKey(): Promise<void> {
  await ai.removeKey()
  toasts.show('Clave quitada')
}

async function test(): Promise<void> {
  busy.value = true
  testResult.value = null
  try {
    testResult.value = { ok: true, text: await ai.test() }
  }
  catch (error) {
    testResult.value = { ok: false, text: (error as Error).message }
  }
  finally {
    busy.value = false
  }
}

watch(() => store.provider, () => {
  testResult.value = null
})

// ------------------------------------------------------------------- tonos

const newTone = reactive({ name: '', prompt: '' })
const editing = ref<string | null>(null)
const editDraft = reactive({ name: '', prompt: '' })

function addTone(): void {
  if (!newTone.name.trim() || !newTone.prompt.trim()) return
  store.addTone(newTone)
  toasts.show(`Tono "${newTone.name.trim()}" añadido`)
  newTone.name = ''
  newTone.prompt = ''
}

function startEdit(id: string): void {
  const tone = store.tones.find(t => t.id === id)
  if (!tone) return
  editing.value = id
  editDraft.name = tone.name
  editDraft.prompt = tone.prompt
}

function saveEdit(): void {
  if (!editing.value) return
  store.updateTone(editing.value, { ...editDraft })
  editing.value = null
}

const FIELD = 'min-h-[var(--control-min)] w-full rounded-[var(--radius-control)] border border-separator bg-surface px-2.5'
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Conexión -->
    <section aria-labelledby="settings-ai-engine">
      <h3
        id="settings-ai-engine"
        class="font-semibold"
      >
        Motor de IA
      </h3>
      <p class="mt-0.5 text-secondary">
        Con la API, la clave se guarda en el servidor y nunca llega al navegador. El runner usa tu cuenta de Claude Code en este equipo.
      </p>

      <div class="mt-3 flex flex-col gap-3">
        <label class="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3">
          <span class="font-semibold">Motor</span>
          <UiSelect
            v-model="store.provider"
            :options="PROVIDERS"
          />
        </label>

        <template v-if="store.provider === 'api'">
          <p class="inline-flex items-center gap-1.5 text-[length:var(--text-caption)]">
            <Icon
              :name="ai.status.data.value?.hasKey ? 'lucide:circle-check' : 'lucide:circle-alert'"
              class="size-4"
              :class="ai.status.data.value?.hasKey ? 'text-success' : 'text-warning'"
              aria-hidden="true"
            />
            {{ ai.status.data.value?.hasKey
              ? (ai.status.data.value.source === 'env' ? 'Hay una clave configurada en el servidor.' : 'Tu clave está guardada en la sesión.')
              : 'Todavía no hay clave.' }}
          </p>
          <form
            class="flex flex-wrap gap-2"
            @submit.prevent="saveKey"
          >
            <label class="min-w-0 flex-1">
              <span class="sr-only">Clave de la API de Anthropic</span>
              <input
                v-model="keyDraft"
                type="password"
                autocomplete="off"
                placeholder="sk-ant-…"
                :class="FIELD"
              >
            </label>
            <UiButton
              type="submit"
              :label="busy ? 'Comprobando…' : 'Guardar clave'"
              :disabled="busy || !keyDraft.trim()"
            />
            <UiButton
              v-if="ai.status.data.value?.source === 'session'"
              label="Quitar clave"
              variant="ghost"
              @click="removeKey"
            />
          </form>
        </template>

        <template v-if="store.provider === 'runner'">
          <label class="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3">
            <span class="font-semibold">URL</span>
            <input
              v-model="store.runnerUrl"
              type="url"
              placeholder="http://127.0.0.1:4317"
              :class="[FIELD, 'data']"
            >
          </label>
          <label class="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-3">
            <span class="pt-2 font-semibold">Token</span>
            <span class="flex flex-col gap-1">
              <input
                v-model="store.runnerToken"
                type="password"
                autocomplete="off"
                placeholder="El que imprime pnpm agent:runner al arrancar"
                :class="[FIELD, 'data']"
              >
              <span class="text-[length:var(--text-caption)] text-secondary">Solo se guarda mientras la pestaña está abierta.</span>
            </span>
          </label>
        </template>

        <div
          v-if="store.provider"
          class="flex flex-wrap items-center gap-3"
        >
          <UiButton
            label="Probar conexión"
            icon="lucide:plug-zap"
            :disabled="busy || !ai.ready.value"
            @click="test"
          />
          <p
            v-if="testResult"
            role="status"
            class="inline-flex items-center gap-1.5 text-[length:var(--text-caption)]"
            :class="testResult.ok ? 'text-success' : 'text-warning'"
          >
            <Icon
              :name="testResult.ok ? 'lucide:circle-check' : 'lucide:circle-alert'"
              class="size-4"
              aria-hidden="true"
            />
            {{ testResult.text }}
          </p>
        </div>
      </div>
    </section>

    <!-- Modelos y autocompletados -->
    <section
      v-if="store.provider"
      aria-labelledby="settings-ai-features"
    >
      <h3
        id="settings-ai-features"
        class="font-semibold"
      >
        Funciones
      </h3>
      <div class="mt-3 flex flex-col gap-3">
        <label class="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3">
          <span class="font-semibold">Mejorar</span>
          <UiSelect
            :model-value="store.improveModel"
            :options="MODEL_OPTIONS"
            @update:model-value="store.improveModel = $event as AiModel"
          />
        </label>
        <label class="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3">
          <span class="font-semibold">Autocompletar</span>
          <UiSelect
            :model-value="store.completeModel"
            :options="MODEL_OPTIONS"
            @update:model-value="store.completeModel = $event as AiModel"
          />
        </label>
        <p class="text-[length:var(--text-caption)] text-secondary">
          El autocompletado responde mientras escribes: un modelo más rápido se nota.
        </p>
        <label class="flex items-start gap-2">
          <input
            v-model="store.ghostEnabled"
            type="checkbox"
            class="mt-1"
          >
          <span>
            <span class="font-semibold">Sugerir cómo seguir al escribir</span>
            <span class="block text-[length:var(--text-caption)] text-secondary">Texto en gris al final de lo que escribes; Tab lo acepta.</span>
          </span>
        </label>
        <label class="flex items-start gap-2">
          <input
            v-model="store.suggestEnabled"
            type="checkbox"
            class="mt-1"
          >
          <span>
            <span class="font-semibold">Proponer campos al crear tareas</span>
            <span class="block text-[length:var(--text-caption)] text-secondary">Tipo, prioridad, descripción y estimación a partir del asunto.</span>
          </span>
        </label>
      </div>
    </section>

    <!-- Tonos -->
    <section aria-labelledby="settings-ai-tones">
      <h3
        id="settings-ai-tones"
        class="font-semibold"
      >
        Tonos para mejorar textos
      </h3>
      <p class="mt-0.5 text-secondary">
        Aparecen al pulsar ✦ sobre un texto seleccionado. Los de fábrica se pueden ocultar.
      </p>

      <ul class="mt-3 flex flex-col divide-y divide-separator rounded-[var(--radius-control)] border border-separator">
        <li
          v-for="(tone, index) in store.tones"
          :key="tone.id"
          class="flex flex-col gap-2 px-3 py-2"
          :class="tone.hidden ? 'opacity-60' : ''"
        >
          <form
            v-if="editing === tone.id"
            class="flex flex-col gap-2"
            @submit.prevent="saveEdit"
          >
            <input
              v-model="editDraft.name"
              :maxlength="MAX_TONE_NAME"
              aria-label="Nombre del tono"
              :class="FIELD"
            >
            <textarea
              v-model="editDraft.prompt"
              rows="3"
              :maxlength="MAX_TONE_PROMPT"
              aria-label="Instrucciones del tono"
              :class="[FIELD, 'py-2']"
            />
            <div class="flex justify-end gap-2">
              <UiButton
                label="Cancelar"
                variant="ghost"
                @click="editing = null"
              />
              <UiButton
                type="submit"
                label="Guardar tono"
                variant="primary"
              />
            </div>
          </form>
          <div
            v-else
            class="flex items-start gap-2"
          >
            <span class="min-w-0 flex-1">
              <span class="font-medium">{{ tone.name }}</span>
              <span
                v-if="tone.builtIn"
                class="ml-1.5 text-[length:var(--text-caption)] text-tertiary"
              >De fábrica</span>
              <span class="block truncate text-[length:var(--text-caption)] text-secondary">{{ tone.prompt }}</span>
            </span>
            <UiButton
              :label="`Subir ${tone.name}`"
              icon="lucide:chevron-up"
              icon-only
              variant="ghost"
              :disabled="index === 0"
              @click="store.moveTone(tone.id, -1)"
            />
            <UiButton
              :label="`Bajar ${tone.name}`"
              icon="lucide:chevron-down"
              icon-only
              variant="ghost"
              :disabled="index === store.tones.length - 1"
              @click="store.moveTone(tone.id, 1)"
            />
            <UiButton
              v-if="!tone.builtIn"
              :label="`Editar ${tone.name}`"
              icon="lucide:pencil"
              icon-only
              variant="ghost"
              @click="startEdit(tone.id)"
            />
            <UiButton
              v-if="tone.builtIn"
              :label="tone.hidden ? `Mostrar ${tone.name}` : `Ocultar ${tone.name}`"
              :icon="tone.hidden ? 'lucide:eye' : 'lucide:eye-off'"
              icon-only
              variant="ghost"
              @click="store.updateTone(tone.id, { hidden: !tone.hidden })"
            />
            <UiButton
              v-else
              :label="`Borrar ${tone.name}`"
              icon="lucide:trash-2"
              icon-only
              variant="ghost"
              @click="store.removeTone(tone.id)"
            />
          </div>
        </li>
      </ul>

      <form
        class="mt-3 flex flex-col gap-2"
        aria-label="Nuevo tono"
        @submit.prevent="addTone"
      >
        <input
          v-model="newTone.name"
          :maxlength="MAX_TONE_NAME"
          placeholder="Nombre, p. ej. Tono académico"
          aria-label="Nombre del nuevo tono"
          :class="FIELD"
        >
        <textarea
          v-model="newTone.prompt"
          rows="3"
          :maxlength="MAX_TONE_PROMPT"
          placeholder="Instrucciones, p. ej. Debes usar un tono impersonal, serio y conciso…"
          aria-label="Instrucciones del nuevo tono"
          :class="[FIELD, 'py-2']"
        />
        <UiButton
          type="submit"
          label="Añadir tono"
          icon="lucide:plus"
          class="self-end"
          :disabled="!newTone.name.trim() || !newTone.prompt.trim()"
        />
      </form>
    </section>
  </div>
</template>
