// @vitest-environment node
import type { ImportRow } from '../../shared/import/validate'
import { describe, expect, it } from 'vitest'
import { levels, runBatch, summarize } from '../../shared/import/batch'

function row(line: number, fila: number, parent?: number | `#${number}`): ImportRow {
  return {
    line,
    fila,
    cells: {},
    payload: { subject: `fila ${fila}` },
    parent: parent === undefined ? null : typeof parent === 'number' ? { kind: 'row', fila: parent } : { kind: 'issue', id: Number(parent.slice(1)) },
  }
}

class HttpError extends Error {
  constructor(readonly status: number, message = `HTTP ${status}`) {
    super(message)
  }
}

const noSleep = async () => {}

describe('lote', () => {
  it('ordena por niveles', () => {
    const depth = levels([row(3, 1), row(4, 2, 1), row(5, 3, 2), row(6, 4, '#90')])
    expect([...depth.values()]).toEqual([0, 1, 2, 0])
  })

  it('50 filas con 2 rechazadas: 48 creadas y los hijos de una fallida no se crean', async () => {
    const rows = Array.from({ length: 50 }, (_, i) => row(3 + i, i + 1))
    rows[10] = row(13, 11, 7) // hija de la fila 7
    let next = 100
    const created: unknown[] = []
    const results = await runBatch(rows, async (payload) => {
      if (payload.subject === 'fila 7' || payload.subject === 'fila 20') throw new HttpError(422, 'Asunto no válido')
      created.push(payload)
      return next++
    }, { sleep: noSleep })

    const summary = summarize(results)
    expect(summary.created).toBe(47)
    expect(summary.failed).toBe(3)
    expect(results.find(r => r.line === 13)).toEqual({ line: 13, status: 'skipped', message: 'No creada: falló el padre (fila 7)' })
    expect(results.find(r => r.line === 9)).toEqual({ line: 9, status: 'error', message: 'Asunto no válido' })
  })

  it('los hijos reciben el id del padre y los de #id el de la tarea existente', async () => {
    const seen: Record<string, unknown>[] = []
    let next = 500
    await runBatch([row(3, 1), row(4, 2, 1), row(5, 3, '#77')], async (payload) => {
      seen.push(payload)
      return next++
    }, { sleep: noSleep })
    expect(seen.find(p => p.subject === 'fila 2')?.parent_issue_id).toBe(500)
    expect(seen.find(p => p.subject === 'fila 3')?.parent_issue_id).toBe(77)
  })

  it('reintenta 429 y 5xx con espera creciente, no 422', async () => {
    const waits: number[] = []
    let calls = 0
    const results = await runBatch([row(3, 1)], async () => {
      calls++
      if (calls < 3) throw new HttpError(calls === 1 ? 429 : 503)
      return 9
    }, { sleep: async (ms) => {
      waits.push(ms)
    }, backoffMs: 100 })
    expect(results[0]).toEqual({ line: 3, status: 'created', id: 9 })
    expect(waits).toEqual([100, 200])

    let tries = 0
    await runBatch([row(3, 1)], async () => {
      tries++
      throw new HttpError(422)
    }, { sleep: noSleep })
    expect(tries).toBe(1)
  })

  it('no pasa de 3 a la vez', async () => {
    let running = 0
    let peak = 0
    await runBatch(Array.from({ length: 10 }, (_, i) => row(3 + i, i + 1)), async () => {
      running++
      peak = Math.max(peak, running)
      await new Promise(resolve => setTimeout(resolve, 5))
      running--
      return 1
    })
    expect(peak).toBe(3)
  })

  it('cancelar para antes de la siguiente y dice qué se creó', async () => {
    const controller = new AbortController()
    let n = 0
    const results = await runBatch(Array.from({ length: 6 }, (_, i) => row(3 + i, i + 1)), async () => {
      n++
      if (n === 2) controller.abort()
      return n
    }, { concurrency: 1, signal: controller.signal })
    expect(results.map(r => r.status)).toEqual(['created', 'created', 'cancelled', 'cancelled', 'cancelled', 'cancelled'])
    expect(summarize(results).label).toBe('2 tareas importadas · 4 sin crear (cancelado)')
  })
})
