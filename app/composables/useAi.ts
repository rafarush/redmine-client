import type { AiRequest, AiResponse, FieldSuggestion } from '../../shared/ai/contract'
import { useQuery, useQueryClient } from '@tanstack/vue-query'

/**
 * La IA para escribir desde la interfaz (F12): manda la tarea al motor elegido
 * (Nitro con la API de Anthropic, o el runner local) y devuelve el resultado o un
 * error con un mensaje para la persona.
 */

export class AiError extends Error {
  constructor(message: string, readonly status = 0) {
    super(message)
  }
}

interface AiStatus { hasKey: boolean, source: 'session' | 'env' | null }

/** Mensaje legible de un fallo de `$fetch` (Nitro) o de `fetch` (runner). */
function messageOf(error: unknown, fallback: string): string {
  const data = (error as { data?: { statusMessage?: string, message?: string } })?.data
  return data?.statusMessage || data?.message || (error instanceof Error && error.message) || fallback
}

export function useAi() {
  const store = useAiStore()
  const queryClient = useQueryClient()

  const status = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => $fetch<AiStatus>('/api/ai/status'),
    enabled: computed(() => store.provider === 'api'),
    staleTime: 60_000,
  })

  /** Hay un motor listo para usar. */
  const ready = computed(() => {
    if (store.provider === 'api') return status.data.value?.hasKey === true
    if (store.provider === 'runner') return !!store.runnerUrl && !!store.runnerToken
    return false
  })

  /** Por qué no está listo, en una frase, para el botón "Configurar IA". */
  const notReadyReason = computed(() => {
    if (!store.provider) return 'Elige un motor de IA en Ajustes.'
    if (store.provider === 'api') return 'Falta la clave de la API de Anthropic.'
    return store.runnerToken ? 'Falta la URL del runner.' : 'Pega el token del runner (se pide de nuevo al recargar).'
  })

  async function request(body: AiRequest, signal?: AbortSignal): Promise<AiResponse> {
    if (!ready.value) throw new AiError(notReadyReason.value, 412)
    try {
      if (store.provider === 'api') {
        return await $fetch<AiResponse>('/api/ai/complete', {
          method: 'POST',
          body,
          signal,
          headers: { 'X-Requested-With': 'redmine-client' },
        })
      }
      const response = await fetch(`${store.runnerUrl.replace(/\/$/, '')}/ai/complete`, {
        method: 'POST',
        signal,
        headers: { 'authorization': `Bearer ${store.runnerToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({})) as AiResponse & { message?: string, error?: string }
      if (!response.ok) {
        const message = response.status === 401 ? 'El token del runner no es válido.' : data.message ?? `El runner respondió ${response.status}.`
        throw new AiError(message, response.status)
      }
      return data
    }
    catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      if ((error as { name?: string })?.name === 'AbortError') throw error
      if (error instanceof AiError) throw error
      if (error instanceof TypeError) throw new AiError(store.provider === 'runner' ? 'No se pudo contactar con el runner. ¿Está arrancado (pnpm agent:runner)?' : 'No se pudo contactar con el servidor.')
      throw new AiError(messageOf(error, 'La IA no ha podido responder.'), (error as { statusCode?: number })?.statusCode ?? 0)
    }
  }

  async function improve(text: string, instruction: string, context?: string, signal?: AbortSignal): Promise<string> {
    const result = await request({ task: 'improve', text, instruction, context, model: store.improveModel }, signal)
    if (result.kind !== 'text' || !result.text.trim()) throw new AiError('La IA no ha devuelto texto.')
    return result.text
  }

  async function continueText(before: string, signal?: AbortSignal): Promise<string> {
    const result = await request({ task: 'continue', before, model: store.completeModel }, signal)
    return result.kind === 'text' ? result.text : ''
  }

  async function suggestFields(input: { subject: string, description?: string, trackers: string[], priorities: string[] }, signal?: AbortSignal): Promise<FieldSuggestion> {
    const result = await request({ task: 'fill', ...input, model: store.completeModel }, signal)
    if (result.kind !== 'fill') throw new AiError('La IA no ha devuelto una propuesta.')
    return result.suggestion
  }

  /** "Probar conexión": la API con una petición mínima; el runner con `/health`. */
  async function test(): Promise<string> {
    if (store.provider === 'runner') {
      try {
        const response = await fetch(`${store.runnerUrl.replace(/\/$/, '')}/health`, { headers: { authorization: `Bearer ${store.runnerToken}` } })
        if (response.status === 401) throw new AiError('El token del runner no es válido.')
        if (!response.ok) throw new AiError(`El runner respondió ${response.status}.`)
      }
      catch (error) {
        if (error instanceof AiError) throw error
        throw new AiError('No se pudo contactar con el runner. ¿Está arrancado (pnpm agent:runner)?')
      }
    }
    await continueText('Prueba de conexión: responde con una palabra.')
    return store.provider === 'runner' ? 'El runner y Claude Code responden.' : 'La API de Anthropic responde.'
  }

  async function saveKey(key: string): Promise<void> {
    try {
      await $fetch('/api/ai/key', { method: 'POST', body: { key }, headers: { 'X-Requested-With': 'redmine-client' } })
    }
    catch (error) {
      throw new AiError(messageOf(error, 'No se pudo guardar la clave.'))
    }
    await queryClient.invalidateQueries({ queryKey: ['ai-status'] })
  }

  async function removeKey(): Promise<void> {
    await $fetch('/api/ai/key', { method: 'DELETE', headers: { 'X-Requested-With': 'redmine-client' } })
    await queryClient.invalidateQueries({ queryKey: ['ai-status'] })
  }

  /** Abre Ajustes en la pestaña de IA (desde "Configurar IA"). */
  function openSettings(): void {
    useState('workspace-settings-tab').value = 'ai'
    useState('workspace-settings-open').value = true
  }

  return { store, status, ready, notReadyReason, improve, continueText, suggestFields, test, saveKey, removeKey, openSettings }
}
