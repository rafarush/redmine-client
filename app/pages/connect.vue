<script setup lang="ts">
import type { RedmineClient } from '../../shared/redmine/client'

/**
 * Único paso de configuración (F1-T04): URL y clave de API.
 * Sin tutorial ni asistente: se entra y se usa (HIG onboarding.md).
 */
definePageMeta({ layout: 'bare' })

const session = useSessionStore()
const { $redmine } = useNuxtApp()

const url = ref(session.rememberedUrl())
const apiKey = ref('')
const showKey = ref(false)
const submitting = ref(false)
const error = ref(session.entryNotice)
const fieldInError = ref<'url' | 'apiKey' | null>(session.entryNotice ? 'apiKey' : null)

session.entryNotice = ''

/** Enlace a la página donde Redmine enseña la clave, con la URL que ya escribió. */
const myAccountLink = computed(() => {
  const typed = url.value.trim()
  if (!typed) return null
  try {
    const base = /^https?:\/\//i.test(typed) ? typed : `https://${typed}`
    return `${new URL(base).origin}/my/account`
  }
  catch {
    return null
  }
})

const canSubmit = computed(() => url.value.trim().length > 0 && apiKey.value.trim().length > 0)

async function connect(): Promise<void> {
  if (!canSubmit.value || submitting.value) return

  submitting.value = true
  error.value = ''
  fieldInError.value = null

  let normalized: string
  try {
    ({ url: normalized } = await $fetch<{ url: string }>('/api/session/login', {
      method: 'POST',
      body: { url: url.value.trim(), apiKey: apiKey.value.trim() },
    }))
  }
  catch (e) {
    const failure = e as { statusCode?: number, statusMessage?: string, data?: { statusMessage?: string } }
    error.value = failure.data?.statusMessage ?? failure.statusMessage ?? 'No se pudo conectar. Inténtalo de nuevo.'
    fieldInError.value = failure.statusCode === 401 ? 'apiKey' : 'url'
    submitting.value = false
    return
  }

  // Las credenciales valen; a partir de aquí el fallo es al traer los datos, y
  // decirlo aparte evita hacer dudar de la clave cuando el problema es otro.
  try {
    session.rememberUrl(normalized)
    session.url = normalized
    await session.load($redmine as RedmineClient)
    await navigateTo('/')
  }
  catch (e) {
    console.error('Fallo al cargar la sesión', e)
    error.value = 'Conectamos, pero no pudimos traer tus datos de Redmine. Vuelve a intentarlo.'
    fieldInError.value = null
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="grid min-h-dvh place-items-center p-4">
    <div class="w-full max-w-sm">
      <div class="mb-6 text-center">
        <Icon
          name="lucide:ticket"
          class="size-7 text-accent"
          aria-hidden="true"
        />
        <h1 class="mt-2 text-[length:var(--text-large-title)] font-semibold">
          Conecta con tu Redmine
        </h1>
        <p class="mt-1 text-secondary">
          Se guarda en este dispositivo. Verás solo lo que tu usuario puede hacer.
        </p>
      </div>

      <form
        class="flex flex-col gap-4"
        novalidate
        @submit.prevent="connect"
      >
        <div class="flex flex-col gap-1">
          <label
            for="url"
            class="font-medium"
          >Dirección de Redmine</label>
          <input
            id="url"
            v-model="url"
            type="url"
            inputmode="url"
            autocomplete="url"
            placeholder="https://redmine.miempresa.com"
            class="min-h-[var(--control-min)] rounded-[var(--radius-control)] border bg-raised px-2.5 text-[length:var(--text-body)] outline-none focus-visible:border-accent"
            :class="fieldInError === 'url' ? 'border-warning' : 'border-separator'"
            :aria-invalid="fieldInError === 'url'"
            :aria-describedby="fieldInError === 'url' ? 'error' : undefined"
          >
        </div>

        <div class="flex flex-col gap-1">
          <label
            for="apiKey"
            class="font-medium"
          >Clave de acceso a la API</label>
          <div class="flex gap-1">
            <input
              id="apiKey"
              v-model="apiKey"
              :type="showKey ? 'text' : 'password'"
              autocomplete="off"
              spellcheck="false"
              placeholder="40 caracteres"
              class="data min-h-[var(--control-min)] flex-1 rounded-[var(--radius-control)] border bg-raised px-2.5 text-[length:var(--text-body)] outline-none focus-visible:border-accent"
              :class="fieldInError === 'apiKey' ? 'border-warning' : 'border-separator'"
              :aria-invalid="fieldInError === 'apiKey'"
              :aria-describedby="`key-help${fieldInError === 'apiKey' ? ' error' : ''}`"
            >
            <UiButton
              :label="showKey ? 'Ocultar la clave' : 'Mostrar la clave'"
              :icon="showKey ? 'lucide:eye-off' : 'lucide:eye'"
              variant="ghost"
              icon-only
              @click="showKey = !showKey"
            />
          </div>
          <p
            id="key-help"
            class="text-[length:var(--text-caption)] text-secondary"
          >
            Está en Redmine, en
            <a
              v-if="myAccountLink"
              :href="myAccountLink"
              target="_blank"
              rel="noopener"
              class="text-info underline underline-offset-2"
            >Mi cuenta → Clave de acceso a la API</a>
            <span v-else>Mi cuenta → Clave de acceso a la API</span>.
          </p>
        </div>

        <p
          v-if="error"
          id="error"
          class="flex items-start gap-1.5 text-warning"
          role="alert"
        >
          <Icon
            name="lucide:triangle-alert"
            class="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          {{ error }}
        </p>

        <UiButton
          :label="submitting ? 'Conectando…' : 'Conectar'"
          variant="primary"
          type="submit"
          :disabled="!canSubmit || submitting"
          class="mt-1"
        />
      </form>
    </div>
  </main>
</template>
