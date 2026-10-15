import type { z } from 'zod'
import type { RedmineTransport } from './transport'
import type {
  CurrentUser,
  Enumeration,
  Issue,
  IssueStatus,
  Paginated,
  Project,
  Ref,
  RoleDetail,
  SavedQuery,
  TimeEntry,
  Version,
} from './types'
import {
  currentUserSchema,
  enumerationSchema,
  issueSchema,
  issueStatusSchema,
  paginatedSchema,
  projectSchema,
  refSchema,
  roleDetailSchema,
  savedQuerySchema,
  timeEntrySchema,
  versionSchema,
} from './types'

/** Tope de Redmine por página. */
const PAGE_LIMIT = 100

export type Query = Record<string, string | number | boolean | undefined>

/**
 * Cliente tipado de Redmine (F1-T01). No sabe si habla por el proxy o directo:
 * eso lo decide el transport que recibe.
 */
export class RedmineClient {
  constructor(private readonly transport: RedmineTransport) {}

  private async get<T>(path: string, schema: z.ZodType<T>, query?: Query): Promise<T> {
    return schema.parse(await this.transport.request({ path, query }))
  }

  /** Recorre todas las páginas. Para catálogos, que son pocos cientos como mucho. */
  private async getAll<T>(path: string, key: string, item: z.ZodTypeAny, query: Query = {}): Promise<T[]> {
    const schema = paginatedSchema(key, item)
    const all: T[] = []
    for (let offset = 0; ; offset += PAGE_LIMIT) {
      const page = await this.get(path, schema, { ...query, limit: PAGE_LIMIT, offset }) as Paginated<T>
      all.push(...page.items)
      if (page.items.length === 0 || all.length >= page.totalCount) return all
    }
  }

  // ---------------------------------------------------------------- sesión

  /** El usuario de la API key, con sus membresías y grupos. */
  async getCurrentUser(): Promise<CurrentUser> {
    const { user } = await this.transport.request<{ user: unknown }>({
      path: '/users/current.json',
      query: { include: 'memberships,groups' },
    })
    return currentUserSchema.parse(user)
  }

  /** Permisos de un rol. Se pide uno por cada rol de las membresías. */
  async getRole(id: number): Promise<RoleDetail> {
    const { role } = await this.transport.request<{ role: unknown }>({ path: `/roles/${id}.json` })
    return roleDetailSchema.parse(role)
  }

  async listRoles(): Promise<Ref[]> {
    return this.getAll<Ref>('/roles.json', 'roles', refSchema)
  }

  // -------------------------------------------------------------- catálogos

  async listProjects(): Promise<Project[]> {
    return this.getAll<Project>('/projects.json', 'projects', projectSchema, {
      include: 'trackers,enabled_modules',
    })
  }

  async getProject(idOrIdentifier: string | number): Promise<Project> {
    const { project } = await this.transport.request<{ project: unknown }>({
      path: `/projects/${idOrIdentifier}.json`,
      query: { include: 'trackers,issue_categories,issue_custom_fields,time_entry_activities,enabled_modules' },
    })
    return projectSchema.parse(project)
  }

  async listTrackers(): Promise<Ref[]> {
    return this.getAll<Ref>('/trackers.json', 'trackers', refSchema)
  }

  async listIssueStatuses(): Promise<IssueStatus[]> {
    return this.getAll<IssueStatus>('/issue_statuses.json', 'issue_statuses', issueStatusSchema)
  }

  async listPriorities(): Promise<Enumeration[]> {
    return this.getAll<Enumeration>('/enumerations/issue_priorities.json', 'issue_priorities', enumerationSchema)
  }

  async listTimeEntryActivities(): Promise<Enumeration[]> {
    return this.getAll<Enumeration>(
      '/enumerations/time_entry_activities.json', 'time_entry_activities', enumerationSchema,
    )
  }

  async listVersions(projectId: string | number): Promise<Version[]> {
    return this.getAll<Version>(`/projects/${projectId}/versions.json`, 'versions', versionSchema)
  }

  // ----------------------------------------------------------------- tareas

  async listIssues(query: Query = {}): Promise<Paginated<Issue>> {
    return this.get('/issues.json', paginatedSchema('issues', issueSchema), { limit: 25, ...query })
  }

  /** Consultas guardadas que el usuario puede ver (propias y públicas). */
  async listQueries(): Promise<SavedQuery[]> {
    return this.getAll<SavedQuery>('/queries.json', 'queries', savedQuerySchema)
  }

  async getIssue(id: number, include = 'journals,attachments,relations,children,watchers,allowed_statuses'): Promise<Issue> {
    const { issue } = await this.transport.request<{ issue: unknown }>({
      path: `/issues/${id}.json`,
      query: { include },
    })
    return issueSchema.parse(issue)
  }

  async createIssue(issue: Record<string, unknown>): Promise<Issue> {
    const response = await this.transport.request<{ issue: unknown }>({
      method: 'POST', path: '/issues.json', body: { issue },
    })
    return issueSchema.parse(response.issue)
  }

  async updateIssue(id: number, issue: Record<string, unknown>): Promise<void> {
    await this.transport.request({ method: 'PUT', path: `/issues/${id}.json`, body: { issue } })
  }

  // ----------------------------------------------------------------- tiempo

  async listTimeEntries(query: Query = {}): Promise<Paginated<TimeEntry>> {
    return this.get('/time_entries.json', paginatedSchema('time_entries', timeEntrySchema), { limit: 100, ...query })
  }

  async createTimeEntry(timeEntry: Record<string, unknown>): Promise<TimeEntry> {
    const response = await this.transport.request<{ time_entry: unknown }>({
      method: 'POST', path: '/time_entries.json', body: { time_entry: timeEntry },
    })
    return timeEntrySchema.parse(response.time_entry)
  }

  async deleteTimeEntry(id: number): Promise<void> {
    await this.transport.request({ method: 'DELETE', path: `/time_entries/${id}.json` })
  }
}
