import type { z } from 'zod'
import type { RedmineTransport } from './transport'
import type {
  CurrentUser,
  Enumeration,
  Issue,
  IssueStatus,
  News,
  Paginated,
  Project,
  ProjectFile,
  ProjectMember,
  Ref,
  RoleDetail,
  SavedQuery,
  TimeEntry,
  Version,
  WikiPage,
  WikiPageRef,
} from './types'
import {
  currentUserSchema,
  enumerationSchema,
  issueSchema,
  issueStatusSchema,
  newsSchema,
  paginatedSchema,
  projectFileSchema,
  projectMemberSchema,
  projectSchema,
  refSchema,
  roleDetailSchema,
  savedQuerySchema,
  timeEntrySchema,
  versionSchema,
  wikiPageRefSchema,
  wikiPageSchema,
} from './types'
import { encodeSegment } from './paths'

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

  /** Personas de un proyecto, para asignar. Solo las que tienen usuario, no grupos. */
  async listProjectMembers(projectId: string | number): Promise<Ref[]> {
    const members = await this.getAll<ProjectMember>(`/projects/${projectId}/memberships.json`, 'memberships', projectMemberSchema)
    return members.flatMap(m => m.user ? [m.user] : [])
  }

  /** Membresías completas de un proyecto: personas y grupos, con sus roles (F6-T05). */
  async listProjectMemberships(projectId: string | number): Promise<ProjectMember[]> {
    return this.getAll<ProjectMember>(`/projects/${projectId}/memberships.json`, 'memberships', projectMemberSchema)
  }

  /** Personas de un grupo. Redmine solo lo deja ver a administradores: si no, lanza 403. */
  async getGroupUsers(groupId: number): Promise<Ref[]> {
    const { group } = await this.transport.request<{ group: { users?: unknown } }>({
      path: `/groups/${groupId}.json`,
      query: { include: 'users' },
    })
    return refSchema.array().parse(group.users ?? [])
  }

  async getVersion(id: number): Promise<Version> {
    const { version } = await this.transport.request<{ version: unknown }>({ path: `/versions/${id}.json` })
    return versionSchema.parse(version)
  }

  /** Cambia fecha, estado o descripción de una versión (`manage_versions`). Responde 204. */
  async updateVersion(id: number, version: { due_date?: string | null, status?: Version['status'], description?: string }): Promise<void> {
    await this.transport.request({ method: 'PUT', path: `/versions/${id}.json`, body: { version } })
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

  /** Ajusta un registro de tiempo (horas, comentario, actividad). Redmine responde 204 sin cuerpo. */
  async updateTimeEntry(id: number, timeEntry: Record<string, unknown>): Promise<void> {
    await this.transport.request({ method: 'PUT', path: `/time_entries/${id}.json`, body: { time_entry: timeEntry } })
  }

  async deleteTimeEntry(id: number): Promise<void> {
    await this.transport.request({ method: 'DELETE', path: `/time_entries/${id}.json` })
  }

  // ------------------------------------------------------------------- wiki

  /** Índice de páginas de la wiki de un proyecto (sin texto). */
  async listWikiPages(projectId: string | number): Promise<WikiPageRef[]> {
    const { wiki_pages } = await this.transport.request<{ wiki_pages?: unknown }>({ path: `/projects/${projectId}/wiki/index.json` })
    return wikiPageRefSchema.array().parse(wiki_pages ?? [])
  }

  async getWikiPage(projectId: string | number, title: string): Promise<WikiPage> {
    const { wiki_page } = await this.transport.request<{ wiki_page: unknown }>({
      path: `/projects/${projectId}/wiki/${encodeSegment(title)}.json`,
      query: { include: 'attachments' },
    })
    return wikiPageSchema.parse(wiki_page)
  }

  /**
   * Crea o actualiza una página. Con `version`, Redmine responde 409 si alguien la
   * cambió entretanto: nunca se sobrescribe en silencio (F7-T03).
   */
  async saveWikiPage(projectId: string | number, title: string, page: { text: string, comments?: string, version?: number }): Promise<void> {
    await this.transport.request({
      method: 'PUT',
      path: `/projects/${projectId}/wiki/${encodeSegment(title)}.json`,
      body: { wiki_page: page },
    })
  }

  // --------------------------------------------------------------- noticias

  /** Noticias de un proyecto o de todos los visibles, las más recientes primero. */
  async listNews(projectId?: string | number, query: Query = {}): Promise<Paginated<News>> {
    const path = projectId === undefined ? '/news.json' : `/projects/${projectId}/news.json`
    return this.get(path, paginatedSchema('news', newsSchema), { limit: 25, ...query })
  }

  async getNews(id: number): Promise<News> {
    const { news } = await this.transport.request<{ news: unknown }>({ path: `/news/${id}.json`, query: { include: 'comments,attachments' } })
    return newsSchema.parse(news)
  }

  /** Publica una noticia (Redmine ≥ 5.1, `manage_news`). Responde 204 sin cuerpo. */
  async createNews(projectId: string | number, news: { title: string, summary?: string, description: string }): Promise<void> {
    await this.transport.request({ method: 'POST', path: `/projects/${projectId}/news.json`, body: { news } })
  }

  // --------------------------------------------------------------- archivos

  async listProjectFiles(projectId: string | number): Promise<ProjectFile[]> {
    const { files } = await this.transport.request<{ files?: unknown }>({ path: `/projects/${projectId}/files.json` })
    return projectFileSchema.array().parse(files ?? [])
  }

  /**
   * Sube el contenido a Redmine y devuelve el token con que se adjunta después. Un
   * token que no se llega a usar no deja nada en el proyecto.
   */
  async upload(
    file: Blob,
    filename: string,
    options: { signal?: AbortSignal, onProgress?: (loaded: number, total: number) => void } = {},
  ): Promise<string> {
    const { upload } = await this.transport.request<{ upload: { token: string } }>({
      method: 'POST',
      path: '/uploads.json',
      query: { filename },
      rawBody: file,
      signal: options.signal,
      onUploadProgress: options.onProgress,
    })
    return upload.token
  }

  /** Añade a los archivos del proyecto lo subido con `upload` (`manage_files`). */
  async addProjectFile(projectId: string | number, file: { token: string, filename: string, version_id?: number, description?: string }): Promise<void> {
    await this.transport.request({ method: 'POST', path: `/projects/${projectId}/files.json`, body: { file } })
  }
}
