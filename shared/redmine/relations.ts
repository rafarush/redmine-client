import { z } from 'zod'
import { refSchema } from './types'

/**
 * Relaciones, subtareas y observadores de una tarea (F3-T05). Redmine los da con
 * `include=relations,children,watchers`; aquí se leen y se nombran en español
 * desde el punto de vista de la tarea abierta ("bloquea a" / "bloqueada por").
 */

export const RELATION_TYPES = ['relates', 'duplicates', 'duplicated', 'blocks', 'blocked', 'precedes', 'follows', 'copied_to', 'copied_from'] as const
export type RelationType = typeof RELATION_TYPES[number]

export const relationSchema = z.object({
  id: z.number(),
  issue_id: z.number(),
  issue_to_id: z.number(),
  relation_type: z.string(),
  delay: z.number().nullish(),
}).loose()
export type Relation = z.infer<typeof relationSchema>

interface Child {
  id: number
  subject: string
  tracker?: { id: number, name: string }
  children?: Child[]
}

const childSchema: z.ZodType<Child> = z.lazy(() => z.object({
  id: z.number(),
  subject: z.string(),
  tracker: refSchema.optional(),
  children: z.array(childSchema).optional(),
}).loose())

const extrasSchema = z.object({
  relations: z.array(relationSchema).default([]),
  children: z.array(childSchema).default([]),
  watchers: z.array(refSchema).default([]),
}).loose()

/** Relaciones, hijas y observadores de una tarea leída con `include=`. Sin `include`, vacíos. */
export function issueExtras(issue: unknown): { relations: Relation[], children: Child[], watchers: { id: number, name: string }[] } {
  const parsed = extrasSchema.safeParse(issue)
  if (!parsed.success) return { relations: [], children: [], watchers: [] }
  const { relations, children, watchers } = parsed.data
  return { relations, children, watchers }
}

/** Cómo se lee cada tipo desde la tarea que lo creó (`issue_id`). */
const FORWARD: Record<RelationType, string> = {
  relates: 'Relacionada con',
  duplicates: 'Duplica a',
  duplicated: 'Duplicada por',
  blocks: 'Bloquea a',
  blocked: 'Bloqueada por',
  precedes: 'Precede a',
  follows: 'Sigue a',
  copied_to: 'Copiada a',
  copied_from: 'Copiada de',
}

/** El mismo vínculo visto desde la otra tarea (`issue_to_id`). */
const REVERSE: Record<RelationType, RelationType> = {
  relates: 'relates',
  duplicates: 'duplicated',
  duplicated: 'duplicates',
  blocks: 'blocked',
  blocked: 'blocks',
  precedes: 'follows',
  follows: 'precedes',
  copied_to: 'copied_from',
  copied_from: 'copied_to',
}

function isRelationType(value: string): value is RelationType {
  return (RELATION_TYPES as readonly string[]).includes(value)
}

/**
 * Una relación vista desde `issueId`: la otra tarea y la frase ("Bloqueada por").
 * Con retraso (`precedes`/`follows`), se añade: "Precede a (2 días)".
 */
export function describeRelation(relation: Relation, issueId: number): { otherId: number, label: string } {
  const outgoing = relation.issue_id === issueId
  const type = isRelationType(relation.relation_type) ? relation.relation_type : undefined
  const seen = type ? (outgoing ? type : REVERSE[type]) : undefined
  const delay = relation.delay ? ` (${relation.delay} ${relation.delay === 1 ? 'día' : 'días'})` : ''
  return {
    otherId: outgoing ? relation.issue_to_id : relation.issue_id,
    label: seen ? `${FORWARD[seen]}${delay}` : relation.relation_type,
  }
}

/** Tipos que se ofrecen al crear (los inversos los genera Redmine solo). */
export const CREATABLE_RELATIONS: { type: RelationType, label: string }[] = [
  { type: 'relates', label: FORWARD.relates },
  { type: 'blocks', label: FORWARD.blocks },
  { type: 'blocked', label: FORWARD.blocked },
  { type: 'precedes', label: FORWARD.precedes },
  { type: 'follows', label: FORWARD.follows },
  { type: 'duplicates', label: FORWARD.duplicates },
  { type: 'duplicated', label: FORWARD.duplicated },
]

/** Lo que escribe la persona al buscar una tarea: `#N` o `N` es un número; el resto, texto del asunto. */
export function parseIssueSearch(text: string): { id: number } | { subject: string } | null {
  const value = text.trim()
  if (!value) return null
  const match = /^#?(\d+)$/.exec(value)
  return match ? { id: Number(match[1]) } : { subject: value }
}
