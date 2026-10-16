import { describe, expect, it } from 'vitest'
import { DEFAULT_AGENT_CONFIG, isAgentConfigured, isLocalRunnerUrl, sanitizeAgentConfig, sanitizeAgentState } from '../../shared/agent/model'
import { canTransition, enqueue, moveQueued, nextQueued, removeItem, transition } from '../../shared/agent/queue'

let n = 0
const makeId = () => `q${++n}`

describe('sanitizeAgentConfig', () => {
  it('devuelve los valores por defecto con basura', () => {
    expect(sanitizeAgentConfig(null)).toEqual(DEFAULT_AGENT_CONFIG)
    expect(sanitizeAgentConfig('x')).toEqual(DEFAULT_AGENT_CONFIG)
  })

  it('solo acepta un runner en local y quita la barra final', () => {
    expect(sanitizeAgentConfig({ runnerUrl: ' http://127.0.0.1:4317/ ' }).runnerUrl).toBe('http://127.0.0.1:4317')
    expect(sanitizeAgentConfig({ runnerUrl: 'http://evil.example.com' }).runnerUrl).toBe('')
    expect(isLocalRunnerUrl('ftp://localhost')).toBe(false)
    expect(isLocalRunnerUrl('http://localhost:1')).toBe(true)
  })

  it('descarta ids de estado inválidos y comandos vacíos', () => {
    const config = sanitizeAgentConfig({ statusMap: { working: 3, pr_opened: -1, blocked: 'x' }, verifyCommands: ['pnpm test', '  ', 4] })
    expect(config.statusMap).toEqual({ working: 3, pr_opened: undefined, blocked: undefined })
    expect(config.verifyCommands).toEqual(['pnpm test'])
  })

  it('sin runner válido no hay agente configurado', () => {
    expect(isAgentConfigured(DEFAULT_AGENT_CONFIG)).toBe(false)
    expect(isAgentConfigured({ ...DEFAULT_AGENT_CONFIG, runnerUrl: 'http://127.0.0.1:4317' })).toBe(true)
  })
})

describe('sanitizeAgentState', () => {
  it('descarta elementos inválidos y bloquea lo que estaba en curso', () => {
    const state = sanitizeAgentState({
      queue: [
        { id: 'a', issueId: 1, title: 't', status: 'working', addedAt: 1 },
        { id: 'b', issueId: 2, title: 't', status: 'rara', addedAt: 1 },
        { issueId: 3 },
      ],
    })
    expect(state.queue.map(i => [i.id, i.status])).toEqual([['a', 'blocked'], ['b', 'queued']])
  })
})

describe('cola', () => {
  it('encola al final y no repite una tarea pendiente', () => {
    let queue = enqueue([], { id: 5, title: 'A' }, makeId, 1)
    queue = enqueue(queue, { id: 5, title: 'A' }, makeId, 2)
    queue = enqueue(queue, { id: 6, title: 'B' }, makeId, 3)
    expect(queue.map(i => i.issueId)).toEqual([5, 6])
  })

  it('solo permite transiciones válidas', () => {
    expect(canTransition('queued', 'working')).toBe(true)
    expect(canTransition('queued', 'pr_opened')).toBe(false)
    expect(canTransition('pr_opened', 'queued')).toBe(false)
    const queue = enqueue([], { id: 1, title: 'A' }, () => 'x', 0)
    expect(transition(queue, 'x', 'pr_opened')[0]!.status).toBe('queued')
    expect(transition(queue, 'x', 'working')[0]!.status).toBe('working')
  })

  it('reintentar limpia el motivo del bloqueo', () => {
    let queue = enqueue([], { id: 1, title: 'A' }, () => 'x', 0)
    queue = transition(queue, 'x', 'working')
    queue = transition(queue, 'x', 'blocked', { reason: 'falló lint' })
    expect(queue[0]!.reason).toBe('falló lint')
    expect(transition(queue, 'x', 'queued')[0]!.reason).toBeUndefined()
  })

  it('es secuencial: no da otra tarea mientras hay una en curso', () => {
    let queue = enqueue(enqueue([], { id: 1, title: 'A' }, () => 'a', 0), { id: 2, title: 'B' }, () => 'b', 0)
    expect(nextQueued(queue)!.id).toBe('a')
    queue = transition(queue, 'a', 'working')
    expect(nextQueued(queue)).toBeUndefined()
    queue = transition(transition(queue, 'a', 'testing'), 'a', 'pr_opened')
    expect(nextQueued(queue)!.id).toBe('b')
  })

  it('no quita ni mueve tareas en curso', () => {
    let queue = enqueue(enqueue([], { id: 1, title: 'A' }, () => 'a', 0), { id: 2, title: 'B' }, () => 'b', 0)
    queue = transition(queue, 'a', 'working')
    expect(removeItem(queue, 'a')).toHaveLength(2)
    expect(moveQueued(queue, 'a', 1).map(i => i.id)).toEqual(['a', 'b'])
    expect(moveQueued(queue, 'b', 0).map(i => i.id)).toEqual(['b', 'a'])
  })
})
