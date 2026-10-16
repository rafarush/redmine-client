import type { H3Event } from 'h3'
import type { AiModel, AiResponse, ParsedAiRequest } from '../../shared/ai/contract'
import Anthropic from '@anthropic-ai/sdk'
import { buildPrompt, cleanImproved, parseFillResponse } from '../../shared/ai/prompts'

/**
 * Motor "API" de la IA para escribir (F12, ADR-010). La clave sale de la sesión
 * sellada (la que guardó la persona en Ajustes) o de `NUXT_ANTHROPIC_API_KEY`, y
 * nunca se devuelve ni se registra.
 */

export interface AiSecure {
  anthropicKey?: string
}

export async function anthropicKey(event: H3Event): Promise<{ key: string, source: 'session' | 'env' } | null> {
  const session = await getUserSession(event)
  const fromSession = (session.secure as AiSecure | undefined)?.anthropicKey
  if (fromSession) return { key: fromSession, source: 'session' }
  const fromEnv = useRuntimeConfig(event).anthropicApiKey
  return fromEnv ? { key: fromEnv, source: 'env' } : null
}

/** Opus y Sonnet admiten la recuperación en el servidor ante un rechazo; Haiku no. */
function supportsFallback(model: AiModel): boolean {
  return model !== 'claude-haiku-5-5'
}

/** Llama al modelo con el prompt de la tarea y devuelve el resultado ya limpio. */
export async function runAnthropic(key: string, request: ParsedAiRequest, signal?: AbortSignal): Promise<AiResponse> {
  const prompt = buildPrompt(request)
  const client = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 90_000 })
  const fallback = supportsFallback(request.model)

  const message = await client.beta.messages.create({
    model: request.model,
    max_tokens: prompt.maxTokens,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
    output_config: {
      effort: prompt.effort,
      ...(prompt.schema ? { format: { type: 'json_schema' as const, schema: prompt.schema } } : {}),
    },
    ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
  }, { signal })

  if (message.stop_reason === 'refusal') {
    throw createError({ statusCode: 422, statusMessage: 'El modelo no ha querido procesar este texto.' })
  }
  const text = message.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('')

  if (request.task === 'fill') {
    const suggestion = parseFillResponse(text)
    if (!suggestion) throw createError({ statusCode: 502, statusMessage: 'La respuesta de la IA no se entiende.' })
    return { kind: 'fill', suggestion }
  }
  return { kind: 'text', text: request.task === 'improve' ? cleanImproved(text) : text }
}

/** Errores del SDK → mensajes para la persona, sin detalles internos. */
export function explainAnthropicError(error: unknown): { status: number, message: string } {
  if (error instanceof Anthropic.AuthenticationError) return { status: 401, message: 'La clave de la API de Anthropic no es válida.' }
  if (error instanceof Anthropic.PermissionDeniedError) return { status: 403, message: 'La clave no tiene permiso para usar ese modelo.' }
  if (error instanceof Anthropic.RateLimitError) return { status: 429, message: 'Demasiadas peticiones a la IA. Espera un momento.' }
  if (error instanceof Anthropic.BadRequestError) return { status: 400, message: 'La IA rechazó la petición.' }
  if (error instanceof Anthropic.APIConnectionError) return { status: 502, message: 'No se pudo contactar con la API de Anthropic.' }
  if (error instanceof Anthropic.APIError) return { status: 502, message: `La API de Anthropic respondió ${error.status ?? 'con un error'}.` }
  return { status: 500, message: 'Error inesperado al llamar a la IA.' }
}
