import type { ImportRow } from './validate'

/**
 * Creación en lote (F5-T05): padres antes que hijos (por niveles), 3 a la vez,
 * reintento con espera creciente en 429 y 5xx, y cancelable entre tarea y tarea.
 * Un 422 no frena al resto; los hijos de una fila fallida no se crean y se dice
 * por qué. Puro: la red y las esperas llegan inyectadas.
 */

export type ItemResult
  = | { line: number, status: 'created', id: number }
    | { line: number, status: 'error', message: string }
    | { line: number, status: 'skipped', message: string }
    | { line: number, status: 'cancelled' }

export interface BatchOptions {
  concurrency?: number
  signal?: AbortSignal
  /** Reintentos ante errores pasajeros (429, 5xx, red). */
  retries?: number
  /** Espera base en ms; se dobla en cada intento. */
  backoffMs?: number
  sleep?: (ms: number) => Promise<void>
  /** ¿Merece la pena reintentar? Por defecto: status 0, 429 o ≥ 500. */
  isRetryable?: (error: unknown) => boolean
  describeError?: (error: unknown) => string
  onProgress?: (done: number, total: number, result: ItemResult) => void
}

type Row = Pick<ImportRow, 'line' | 'fila' | 'payload' | 'parent'>

function statusOf(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : undefined
}

function defaultRetryable(error: unknown): boolean {
  const status = statusOf(error)
  return status === 0 || status === 429 || (status !== undefined && status >= 500)
}

/** Nivel de cada fila: 0 sin padre de fila, 1 si su padre es de nivel 0… */
export function levels(rows: readonly Row[]): Map<number, number> {
  const byFila = new Map(rows.filter(r => r.fila !== null).map(r => [r.fila!, r]))
  const depth = new Map<number, number>()
  const of = (row: Row, seen: Set<number>): number => {
    const known = depth.get(row.line)
    if (known !== undefined) return known
    const parent = row.parent?.kind === 'row' ? byFila.get(row.parent.fila) : undefined
    // Un ciclo no debería llegar aquí (lo rechaza la validación); por si acaso, corta.
    const value = parent && !seen.has(parent.line) ? of(parent, new Set([...seen, row.line])) + 1 : 0
    depth.set(row.line, value)
    return value
  }
  for (const row of rows) of(row, new Set())
  return depth
}

export async function runBatch(
  rows: readonly Row[],
  create: (payload: Record<string, unknown>) => Promise<number>,
  options: BatchOptions = {},
): Promise<ItemResult[]> {
  const {
    concurrency = 3,
    signal,
    retries = 3,
    backoffMs = 800,
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
    isRetryable = defaultRetryable,
    describeError = error => (error instanceof Error ? error.message : String(error)),
    onProgress,
  } = options

  const depth = levels(rows)
  const ordered = [...rows].sort((a, b) => depth.get(a.line)! - depth.get(b.line)! || a.line - b.line)
  const byFila = new Map(rows.filter(r => r.fila !== null).map(r => [r.fila!, r]))
  const results = new Map<number, ItemResult>()
  let done = 0

  const finish = (result: ItemResult) => {
    results.set(result.line, result)
    done++
    onProgress?.(done, rows.length, result)
  }

  async function attempt(payload: Record<string, unknown>): Promise<number> {
    for (let i = 0; ; i++) {
      try {
        return await create(payload)
      }
      catch (error) {
        if (i >= retries || !isRetryable(error) || signal?.aborted) throw error
        await sleep(backoffMs * 2 ** i)
      }
    }
  }

  async function process(row: Row): Promise<void> {
    if (signal?.aborted) {
      finish({ line: row.line, status: 'cancelled' })
      return
    }
    let parentId: number | undefined
    if (row.parent?.kind === 'issue') parentId = row.parent.id
    if (row.parent?.kind === 'row') {
      const parentRow = byFila.get(row.parent.fila)
      const parentResult = parentRow ? results.get(parentRow.line) : undefined
      if (parentResult?.status !== 'created') {
        finish({ line: row.line, status: 'skipped', message: `No creada: falló el padre (fila ${row.parent.fila})` })
        return
      }
      parentId = parentResult.id
    }
    if (!row.payload) {
      finish({ line: row.line, status: 'error', message: 'La fila tiene errores' })
      return
    }
    try {
      const id = await attempt(parentId ? { ...row.payload, parent_issue_id: parentId } : row.payload)
      finish({ line: row.line, status: 'created', id })
    }
    catch (error) {
      finish({ line: row.line, status: 'error', message: describeError(error) })
    }
  }

  // Por niveles: un nivel entero termina antes del siguiente, así el padre ya tiene id.
  const maxLevel = Math.max(-1, ...depth.values())
  for (let level = 0; level <= maxLevel; level++) {
    const queue = ordered.filter(r => depth.get(r.line) === level)
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let row = queue.shift(); row; row = queue.shift()) await process(row)
    })
    await Promise.all(workers)
  }

  return rows.map(r => results.get(r.line)!)
}

/** "48 tareas importadas · 2 con error". */
export function summarize(results: readonly ItemResult[]): { created: number, failed: number, cancelled: number, label: string } {
  const created = results.filter(r => r.status === 'created').length
  const failed = results.filter(r => r.status === 'error' || r.status === 'skipped').length
  const cancelled = results.filter(r => r.status === 'cancelled').length
  const parts = [`${created} ${created === 1 ? 'tarea importada' : 'tareas importadas'}`]
  if (failed) parts.push(`${failed} con error`)
  if (cancelled) parts.push(`${cancelled} sin crear (cancelado)`)
  return { created, failed, cancelled, label: parts.join(' · ') }
}
