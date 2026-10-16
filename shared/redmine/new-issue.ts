import { z } from 'zod'
import { parseDuration } from '../time/duration'

/**
 * "Nueva tarea" (F3-T07): el borrador del formulario, su validación y el cuerpo de
 * `POST /issues.json`. Todo es texto en el borrador (lo que hay en los campos);
 * se convierte al enviar.
 */

export interface IssueDraft {
  project_id: string
  tracker_id: string
  subject: string
  description: string
  assigned_to_id: string
  priority_id: string
  // "Más campos"
  fixed_version_id: string
  category_id: string
  start_date: string
  due_date: string
  estimated_hours: string
  parent_issue_id: string
  /** Campos personalizados por id. */
  custom: Record<string, string>
}

export function emptyDraft(defaults: Partial<IssueDraft> = {}): IssueDraft {
  return {
    project_id: '',
    tracker_id: '',
    subject: '',
    description: '',
    assigned_to_id: '',
    priority_id: '',
    fixed_version_id: '',
    category_id: '',
    start_date: '',
    due_date: '',
    estimated_hours: '',
    parent_issue_id: '',
    custom: {},
    ...defaults,
  }
}

/** Lo que la persona ha escrito de verdad (el proyecto, el tipo y la prioridad vienen dados). */
export function isDraftDirty(draft: IssueDraft): boolean {
  const typed = [draft.subject, draft.description, draft.assigned_to_id, draft.fixed_version_id, draft.category_id, draft.start_date, draft.due_date, draft.estimated_hours, draft.parent_issue_id]
  return typed.some(v => v.trim() !== '') || Object.values(draft.custom).some(v => v.trim() !== '')
}

/** Lo guardado en `localStorage`, sin fiarse de su forma. */
export function sanitizeDraft(raw: unknown): IssueDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const base = emptyDraft()
  const out = { ...base } as Record<string, unknown>
  for (const key of Object.keys(base) as (keyof IssueDraft)[]) {
    if (key === 'custom') continue
    if (typeof source[key] === 'string') out[key] = source[key]
  }
  const custom: Record<string, string> = {}
  if (source.custom && typeof source.custom === 'object') {
    for (const [id, value] of Object.entries(source.custom as Record<string, unknown>)) {
      if (/^\d+$/.test(id) && typeof value === 'string') custom[id] = value
    }
  }
  out.custom = custom
  return out as unknown as IssueDraft
}

/** Estimación: un número suelto son horas (puede pasar de 24); si no, una duración ("1h30"). */
function estimate(value: string): number | null {
  const text = value.trim()
  if (/^\d+(?:[.,]\d+)?$/.test(text)) {
    const n = Number(text.replace(',', '.'))
    return n > 0 ? n : null
  }
  return parseDuration(text)
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Validación del borrador. `requiredCustom` son ids de campos personalizados obligatorios, si se conocen. */
export function draftSchema(requiredCustom: number[] = []) {
  return z.object({
    project_id: z.string().min(1, 'Elige un proyecto'),
    tracker_id: z.string().min(1, 'Elige un tipo'),
    subject: z.string().trim().min(1, 'Escribe el asunto').max(255, 'Máximo 255 caracteres'),
    start_date: z.string().refine(v => !v || ISO_DATE.test(v), 'Fecha no válida'),
    due_date: z.string().refine(v => !v || ISO_DATE.test(v), 'Fecha no válida'),
    estimated_hours: z.string().refine(v => !v.trim() || estimate(v) !== null, 'No se entiende (ej.: 4, 1h30)'),
    parent_issue_id: z.string().refine(v => !v.trim() || /^#?\d+$/.test(v.trim()), 'Número de tarea (ej.: 123)'),
    custom: z.record(z.string(), z.string()),
  }).loose().superRefine((draft, ctx) => {
    if (draft.start_date && draft.due_date && draft.due_date < draft.start_date) {
      ctx.addIssue({ code: 'custom', path: ['due_date'], message: 'No puede vencer antes de empezar' })
    }
    for (const id of requiredCustom) {
      if (!draft.custom[String(id)]?.trim()) ctx.addIssue({ code: 'custom', path: ['custom', String(id)], message: 'Obligatorio' })
    }
  })
}

/** Errores por campo (`custom.7` para los personalizados), o vacío si está bien. */
export function validateDraft(draft: IssueDraft, requiredCustom: number[] = []): Record<string, string> {
  const result = draftSchema(requiredCustom).safeParse(draft)
  if (result.success) return {}
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.')
    errors[key] ??= issue.message
  }
  return errors
}

/** Borrador válido → cuerpo de `POST /issues.json`. Lo vacío no se envía. */
export function toCreatePayload(draft: IssueDraft): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    project_id: Number(draft.project_id),
    tracker_id: Number(draft.tracker_id),
    subject: draft.subject.trim(),
  }
  if (draft.description.trim()) payload.description = draft.description
  for (const key of ['assigned_to_id', 'priority_id', 'fixed_version_id', 'category_id'] as const) {
    if (draft[key]) payload[key] = Number(draft[key])
  }
  if (draft.start_date) payload.start_date = draft.start_date
  if (draft.due_date) payload.due_date = draft.due_date
  if (draft.estimated_hours.trim()) payload.estimated_hours = estimate(draft.estimated_hours)
  if (draft.parent_issue_id.trim()) payload.parent_issue_id = Number(draft.parent_issue_id.replace('#', ''))
  const custom = Object.entries(draft.custom).filter(([, v]) => v.trim()).map(([id, value]) => ({ id: Number(id), value: value.trim() }))
  if (custom.length > 0) payload.custom_fields = custom
  return payload
}

/** Lo que se copia de una tarea al duplicarla (F3-T08). El asunto lleva "(copia)" para distinguirla. */
export interface DuplicableIssue {
  project: { id: number }
  tracker: { id: number }
  subject: string
  description?: string | null
  assigned_to?: { id: number }
  priority: { id: number }
  fixed_version?: { id: number }
  category?: { id: number }
  start_date?: string | null
  due_date?: string | null
  estimated_hours?: number | null
  parent?: { id: number }
  custom_fields?: { id: number, value: string | string[] | null, multiple?: boolean }[]
}

export function draftFromIssue(issue: DuplicableIssue): IssueDraft {
  const id = (ref?: { id: number }) => ref ? String(ref.id) : ''
  const custom: Record<string, string> = {}
  for (const field of issue.custom_fields ?? []) {
    if (!field.multiple && typeof field.value === 'string' && field.value) custom[String(field.id)] = field.value
  }
  return emptyDraft({
    project_id: id(issue.project),
    tracker_id: id(issue.tracker),
    subject: `${issue.subject} (copia)`.slice(0, 255),
    description: issue.description ?? '',
    assigned_to_id: id(issue.assigned_to),
    priority_id: id(issue.priority),
    fixed_version_id: id(issue.fixed_version),
    category_id: id(issue.category),
    start_date: issue.start_date ?? '',
    due_date: issue.due_date ?? '',
    estimated_hours: issue.estimated_hours ? String(issue.estimated_hours) : '',
    parent_issue_id: id(issue.parent),
    custom,
  })
}

/**
 * Mover a otro proyecto: si el tipo actual no existe allí hay que elegir otro antes
 * de guardar. Devuelve el cuerpo del `PUT` o qué falta.
 */
export function movePayload(
  target: { id: number, trackers?: { id: number }[] },
  currentTrackerId: number,
  chosenTrackerId?: number,
): { ok: true, payload: Record<string, unknown> } | { ok: false, needsTracker: true } {
  const trackers = target.trackers ?? []
  const keeps = trackers.length === 0 || trackers.some(t => t.id === currentTrackerId)
  if (keeps && chosenTrackerId === undefined) return { ok: true, payload: { project_id: target.id } }
  if (chosenTrackerId !== undefined && (trackers.length === 0 || trackers.some(t => t.id === chosenTrackerId))) {
    return { ok: true, payload: { project_id: target.id, tracker_id: chosenTrackerId } }
  }
  return { ok: false, needsTracker: true }
}

/** "Crear y otra": se queda el proyecto, el tipo y la prioridad; lo demás se vacía. */
export function nextDraft(draft: IssueDraft): IssueDraft {
  return emptyDraft({ project_id: draft.project_id, tracker_id: draft.tracker_id, priority_id: draft.priority_id })
}
