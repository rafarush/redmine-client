/**
 * Tonos de "Mejorar con IA" (F12): cuatro de fábrica, que se pueden ocultar pero
 * no borrar, y los que añada la persona (nombre + prompt). Se guardan en
 * `localStorage`; aquí está todo lo que decide qué se guarda y en qué orden.
 */

export interface Tone {
  id: string
  name: string
  prompt: string
  builtIn?: boolean
  hidden?: boolean
}

export const MAX_TONE_NAME = 40
export const MAX_TONE_PROMPT = 2_000

export const BUILTIN_TONES: readonly Tone[] = [
  { id: 'clear', name: 'Más claro', prompt: 'Haz el texto más claro y fácil de leer: frases cortas, orden lógico y sin ambigüedades. No cambies el significado.', builtIn: true },
  { id: 'formal', name: 'Más formal', prompt: 'Usa un tono profesional y formal, adecuado para clientes y documentación. Evita coloquialismos.', builtIn: true },
  { id: 'concise', name: 'Más conciso', prompt: 'Acorta el texto al mínimo necesario sin perder información importante. Quita repeticiones y relleno.', builtIn: true },
  { id: 'spelling', name: 'Corregir ortografía', prompt: 'Corrige solo la ortografía, la gramática y la puntuación. No cambies el estilo, el tono ni las palabras si son correctas.', builtIn: true },
]

/**
 * Lo guardado → lista válida: los de fábrica siempre (respetando si se ocultaron
 * y su posición) y los propios con nombre y prompt. Ids repetidos se descartan.
 */
export function sanitizeTones(raw: unknown): Tone[] {
  const saved = Array.isArray(raw) ? raw : []
  const out: Tone[] = []
  const seen = new Set<string>()
  for (const item of saved as Record<string, unknown>[]) {
    if (!item || typeof item.id !== 'string' || seen.has(item.id)) continue
    const builtIn = BUILTIN_TONES.find(t => t.id === item.id)
    if (builtIn) {
      out.push({ ...builtIn, hidden: item.hidden === true })
      seen.add(item.id)
      continue
    }
    const name = typeof item.name === 'string' ? item.name.trim().slice(0, MAX_TONE_NAME) : ''
    const prompt = typeof item.prompt === 'string' ? item.prompt.trim().slice(0, MAX_TONE_PROMPT) : ''
    if (!name || !prompt) continue
    out.push({ id: item.id, name, prompt })
    seen.add(item.id)
  }
  // Los de fábrica que falten (primera vez o versión nueva) van al principio.
  const missing = BUILTIN_TONES.filter(t => !seen.has(t.id)).map(t => ({ ...t }))
  return [...missing, ...out]
}

export function visibleTones(tones: readonly Tone[]): Tone[] {
  return tones.filter(t => !t.hidden)
}

export function addTone(tones: readonly Tone[], tone: { name: string, prompt: string }, id: string): Tone[] {
  const name = tone.name.trim().slice(0, MAX_TONE_NAME)
  const prompt = tone.prompt.trim().slice(0, MAX_TONE_PROMPT)
  if (!name || !prompt) return [...tones]
  return [...tones, { id, name, prompt }]
}

/** Los de fábrica no cambian de texto: solo se ocultan o se muestran. */
export function updateTone(tones: readonly Tone[], id: string, changes: { name?: string, prompt?: string, hidden?: boolean }): Tone[] {
  return tones.map((tone) => {
    if (tone.id !== id) return tone
    if (tone.builtIn) return { ...tone, hidden: changes.hidden ?? tone.hidden }
    return {
      ...tone,
      name: changes.name !== undefined && changes.name.trim() ? changes.name.trim().slice(0, MAX_TONE_NAME) : tone.name,
      prompt: changes.prompt !== undefined && changes.prompt.trim() ? changes.prompt.trim().slice(0, MAX_TONE_PROMPT) : tone.prompt,
    }
  })
}

/** Quitar uno de fábrica lo oculta; uno propio se borra. */
export function removeTone(tones: readonly Tone[], id: string): Tone[] {
  const tone = tones.find(t => t.id === id)
  if (tone?.builtIn) return updateTone(tones, id, { hidden: true })
  return tones.filter(t => t.id !== id)
}

export function moveTone(tones: readonly Tone[], id: string, delta: -1 | 1): Tone[] {
  const index = tones.findIndex(t => t.id === id)
  const target = index + delta
  if (index < 0 || target < 0 || target >= tones.length) return [...tones]
  const next = [...tones]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  return next
}
