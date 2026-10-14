import { z } from 'zod'

/**
 * Tipos de la API de Redmine 5.x/6.x (F1-T01).
 *
 * Los esquemas son tolerantes a propósito (`.loose()`): un Redmine con plugins
 * devuelve campos de más, y una versión distinta puede omitir alguno. Validamos
 * lo que la app usa y dejamos pasar el resto, en vez de romper el arranque.
 */

/** `{ id, name }`: la forma en que Redmine referencia casi todo. */
export const refSchema = z.object({ id: z.number(), name: z.string() }).loose()
export type Ref = z.infer<typeof refSchema>

export const customFieldValueSchema = z.object({
  id: z.number(),
  name: z.string(),
  value: z.union([z.string(), z.array(z.string()), z.null()]),
  multiple: z.boolean().optional(),
}).loose()
export type CustomFieldValue = z.infer<typeof customFieldValueSchema>

// ------------------------------------------------------------------ usuario

export const membershipSchema = z.object({
  id: z.number(),
  project: refSchema,
  roles: z.array(refSchema),
}).loose()
export type Membership = z.infer<typeof membershipSchema>

export const currentUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  firstname: z.string(),
  lastname: z.string(),
  mail: z.string().optional(),
  admin: z.boolean().default(false),
  memberships: z.array(membershipSchema).default([]),
  groups: z.array(refSchema).default([]),
  // `api_key` existe en la respuesta pero el proxy la quita: nunca llega al navegador.
}).loose()
export type CurrentUser = z.infer<typeof currentUserSchema>

export const roleDetailSchema = z.object({
  id: z.number(),
  name: z.string(),
  permissions: z.array(z.string()).default([]),
}).loose()
export type RoleDetail = z.infer<typeof roleDetailSchema>

// ---------------------------------------------------------------- proyectos

export const projectSchema = z.object({
  id: z.number(),
  name: z.string(),
  identifier: z.string(),
  description: z.string().nullish(),
  parent: refSchema.optional(),
  /** 1 activo, 5 cerrado, 9 archivado. */
  status: z.number().default(1),
  is_public: z.boolean().optional(),
  trackers: z.array(refSchema).optional(),
  enabled_modules: z.array(refSchema).optional(),
  issue_custom_fields: z.array(refSchema).optional(),
  time_entry_activities: z.array(refSchema).optional(),
}).loose()
export type Project = z.infer<typeof projectSchema>

export const versionSchema = z.object({
  id: z.number(),
  project: refSchema.optional(),
  name: z.string(),
  description: z.string().nullish(),
  status: z.enum(['open', 'locked', 'closed']).default('open'),
  due_date: z.string().nullish(),
}).loose()
export type Version = z.infer<typeof versionSchema>

// -------------------------------------------------------------- catálogos

export const issueStatusSchema = z.object({
  id: z.number(),
  name: z.string(),
  is_closed: z.boolean().default(false),
}).loose()
export type IssueStatus = z.infer<typeof issueStatusSchema>

export const enumerationSchema = z.object({
  id: z.number(),
  name: z.string(),
  is_default: z.boolean().optional(),
  active: z.boolean().optional(),
}).loose()
export type Enumeration = z.infer<typeof enumerationSchema>

// ------------------------------------------------------------------ tareas

export const journalSchema = z.object({
  id: z.number(),
  user: refSchema.optional(),
  notes: z.string().nullish(),
  created_on: z.string(),
  private_notes: z.boolean().optional(),
  details: z.array(z.object({
    property: z.string(),
    name: z.string(),
    old_value: z.string().nullish(),
    new_value: z.string().nullish(),
  }).loose()).default([]),
}).loose()
export type Journal = z.infer<typeof journalSchema>

export const attachmentSchema = z.object({
  id: z.number(),
  filename: z.string(),
  filesize: z.number(),
  content_type: z.string().nullish(),
  description: z.string().nullish(),
  content_url: z.string(),
  author: refSchema.optional(),
  created_on: z.string(),
}).loose()
export type Attachment = z.infer<typeof attachmentSchema>

export const issueSchema = z.object({
  id: z.number(),
  project: refSchema,
  tracker: refSchema,
  status: refSchema,
  priority: refSchema,
  author: refSchema,
  assigned_to: refSchema.optional(),
  category: refSchema.optional(),
  fixed_version: refSchema.optional(),
  parent: z.object({ id: z.number() }).loose().optional(),
  subject: z.string(),
  description: z.string().nullish(),
  start_date: z.string().nullish(),
  due_date: z.string().nullish(),
  done_ratio: z.number().default(0),
  is_private: z.boolean().optional(),
  estimated_hours: z.number().nullish(),
  spent_hours: z.number().nullish(),
  total_spent_hours: z.number().nullish(),
  created_on: z.string(),
  updated_on: z.string(),
  closed_on: z.string().nullish(),
  custom_fields: z.array(customFieldValueSchema).optional(),
  // Con `include=`
  journals: z.array(journalSchema).optional(),
  attachments: z.array(attachmentSchema).optional(),
  /** Estados a los que el workflow permite pasar a este usuario (Redmine >= 5.0). */
  allowed_statuses: z.array(issueStatusSchema).optional(),
}).loose()
export type Issue = z.infer<typeof issueSchema>

// ------------------------------------------------------------------ tiempo

export const timeEntrySchema = z.object({
  id: z.number(),
  project: refSchema,
  issue: z.object({ id: z.number() }).loose().optional(),
  user: refSchema,
  activity: refSchema,
  hours: z.number(),
  comments: z.string().nullish(),
  spent_on: z.string(),
  created_on: z.string(),
  updated_on: z.string(),
}).loose()
export type TimeEntry = z.infer<typeof timeEntrySchema>

// ------------------------------------------------------------- paginación

/** Envoltura de las listas de Redmine: `{ issues: [...], total_count, offset, limit }`. */
export interface Paginated<T> {
  items: T[]
  totalCount: number
  offset: number
  limit: number
}

/*
 * Los metadatos van en un esquema de forma fija y el array se valida aparte: con una
 * clave dinámica dentro del objeto, TypeScript ensancha los tipos y se pierde todo.
 */
const paginationMetaSchema = z.object({
  total_count: z.number().default(0),
  offset: z.number().default(0),
  limit: z.number().default(25),
}).loose()

export function paginatedSchema<T extends z.ZodTypeAny>(clave: string, item: T) {
  return paginationMetaSchema.transform((respuesta): Paginated<z.infer<T>> => ({
    items: z.array(item).parse((respuesta as Record<string, unknown>)[clave] ?? []),
    totalCount: respuesta.total_count,
    offset: respuesta.offset,
    limit: respuesta.limit,
  }))
}
