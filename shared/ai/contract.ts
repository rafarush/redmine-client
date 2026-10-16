import { z } from 'zod'

/**
 * Contrato de la IA para escribir (F12, ADR-010): lo que la app pide y lo que
 * recibe, igual hable con Nitro (API de Anthropic) o con el runner local. El
 * navegador manda la tarea y el texto; el prompt de sistema se construye al otro
 * lado (`prompts.ts`).
 */

export const AI_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] as const
export type AiModel = typeof AI_MODELS[number]
export const DEFAULT_AI_MODEL: AiModel = 'claude-opus-5-5'

export const AI_MODEL_LABELS: Record<AiModel, string> = {
  'claude-opus-5-5': 'Claude Opus 5.5 · mejor calidad',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5 · equilibrado',
  'claude-haiku-5-5': 'Claude Haiku 5.5 · más rápido',
}

/** Límites de tamaño: suficientes para una página de wiki, no para un libro. */
export const MAX_TEXT = 20_000
export const MAX_INSTRUCTION = 2_000

const model = z.enum(AI_MODELS).default(DEFAULT_AI_MODEL)

export const aiRequestSchema = z.discriminatedUnion('task', [
  z.object({
    task: z.literal('improve'),
    /** Lo seleccionado, que se reescribe. */
    text: z.string().trim().min(1).max(MAX_TEXT),
    /** El prompt del tono o el prompt propio. */
    instruction: z.string().trim().min(1).max(MAX_INSTRUCTION),
    /** Texto alrededor de la selección, para que el resultado encaje (no se reescribe). */
    context: z.string().max(4_000).optional(),
    model,
  }),
  z.object({
    task: z.literal('continue'),
    /** Lo escrito hasta el cursor. */
    before: z.string().min(1).max(8_000),
    model,
  }),
  z.object({
    task: z.literal('fill'),
    subject: z.string().trim().min(1).max(255),
    description: z.string().max(MAX_TEXT).optional(),
    trackers: z.array(z.string().max(100)).max(100),
    priorities: z.array(z.string().max(100)).max(50),
    model,
  }),
])

export type AiRequest = z.input<typeof aiRequestSchema>
export type ParsedAiRequest = z.output<typeof aiRequestSchema>

/** Propuesta para una tarea nueva: solo nombres que existen en el proyecto. */
export interface FieldSuggestion {
  tracker?: string
  priority?: string
  description?: string
  estimated_hours?: number
}

export type AiResponse
  = | { kind: 'text', text: string }
    | { kind: 'fill', suggestion: FieldSuggestion }
