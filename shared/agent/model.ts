import { z } from 'zod'

/**
 * Modelo de la Cola de Agente (F11): configuración del agente y tareas encoladas.
 * Lógica pura; el store (`app/stores/agent.ts`) solo persiste lo que esto decide.
 * El token del runner nunca forma parte de este modelo: no se guarda en `localStorage`.
 */

export type AgentKind = 'claude-code'

/** Fases de una tarea de la cola. */
export type QueueStatus = 'queued' | 'working' | 'testing' | 'pr_opened' | 'blocked' | 'cancelled'

/** Estados de Redmine a los que lleva cada fase; sin mapear, esa fase no cambia el estado. */
export interface AgentStatusMap {
  working?: number
  pr_opened?: number
  blocked?: number
}

export interface AgentConfig {
  kind: AgentKind
  /** URL del runner local, p. ej. `http://127.0.0.1:4317`. Vacía = sin agente conectado. */
  runnerUrl: string
  baseBranch: string
  /** Comandos que deben pasar antes de abrir la PR. */
  verifyCommands: string[]
  statusMap: AgentStatusMap
}

export interface QueueItem {
  id: string
  issueId: number
  title: string
  status: QueueStatus
  branch?: string
  prUrl?: string
  /** Motivo del bloqueo o resumen del último error. */
  reason?: string
  addedAt: number
}

export interface AgentState {
  config: AgentConfig
  queue: QueueItem[]
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  kind: 'claude-code',
  runnerUrl: '',
  baseBranch: 'main',
  verifyCommands: ['pnpm lint', 'pnpm typecheck', 'pnpm test'],
  statusMap: {},
}

export const EMPTY_AGENT_STATE: AgentState = { config: DEFAULT_AGENT_CONFIG, queue: [] }

const statusId = z.number().int().positive().optional().catch(undefined)
const queueStatus = z.enum(['queued', 'working', 'testing', 'pr_opened', 'blocked', 'cancelled'])
const itemSchema = z.object({
  id: z.string().min(1),
  issueId: z.number().int().positive(),
  title: z.string().max(255),
  status: queueStatus.catch('queued'),
  branch: z.string().optional().catch(undefined),
  prUrl: z.string().optional().catch(undefined),
  reason: z.string().optional().catch(undefined),
  addedAt: z.number().catch(0),
})

/** Solo se acepta un runner en este equipo: `http(s)://localhost|127.0.0.1[:puerto]`. */
export function isLocalRunnerUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
  }
  catch {
    return false
  }
}

/** ¿Hay un agente utilizable configurado? Si no, la vista ofrece abrir Integraciones IA. */
export function isAgentConfigured(config: AgentConfig): boolean {
  return isLocalRunnerUrl(config.runnerUrl)
}

/** Lo leído de `localStorage` puede ser cualquier cosa: se queda con lo que tiene forma. */
export function sanitizeAgentConfig(raw: unknown): AgentConfig {
  if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_AGENT_CONFIG)
  const value = raw as Record<string, unknown>
  const map = (value.statusMap ?? {}) as Record<string, unknown>
  const runnerUrl = typeof value.runnerUrl === 'string' && isLocalRunnerUrl(value.runnerUrl.trim())
    ? value.runnerUrl.trim().replace(/\/+$/, '')
    : ''
  const commands = Array.isArray(value.verifyCommands)
    ? value.verifyCommands.filter((c): c is string => typeof c === 'string' && c.trim() !== '').map(c => c.trim())
    : DEFAULT_AGENT_CONFIG.verifyCommands
  return {
    kind: 'claude-code',
    runnerUrl,
    baseBranch: typeof value.baseBranch === 'string' && value.baseBranch.trim() ? value.baseBranch.trim() : DEFAULT_AGENT_CONFIG.baseBranch,
    verifyCommands: commands,
    statusMap: {
      working: statusId.parse(map.working),
      pr_opened: statusId.parse(map.pr_opened),
      blocked: statusId.parse(map.blocked),
    },
  }
}

export function sanitizeAgentState(raw: unknown): AgentState {
  if (!raw || typeof raw !== 'object') return structuredClone(EMPTY_AGENT_STATE)
  const value = raw as Record<string, unknown>
  const queue = Array.isArray(value.queue)
    ? value.queue.flatMap((raw) => {
        const parsed = itemSchema.safeParse(raw)
        // Un runner reiniciado no sigue trabajando: lo que estaba en curso queda bloqueado.
        if (!parsed.success) return []
        const item = parsed.data as QueueItem
        return [item.status === 'working' || item.status === 'testing'
          ? { ...item, status: 'blocked' as const, reason: 'Se interrumpió al recargar la app' }
          : item]
      })
    : []
  return { config: sanitizeAgentConfig(value.config), queue }
}
