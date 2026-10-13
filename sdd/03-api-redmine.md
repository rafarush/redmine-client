# 03 · API de Redmine

Referencia: https://www.redmine.org/projects/redmine/wiki/Rest_api (Redmine 5.x/6.x). Todas las llamadas usan JSON y la cabecera `X-Redmine-API-Key`.

## Arranque de sesión

Orden de carga tras conectar (F1):

1. `GET /users/current.json?include=memberships,groups`: usuario, `admin`, membresías por proyecto con roles.
2. `GET /roles/:id.json` por cada rol distinto de las membresías: lista `permissions`.
3. `GET /projects.json?include=trackers,enabled_modules&limit=100` (paginar con `offset`).
4. Catálogos globales en paralelo: `/trackers.json`, `/issue_statuses.json`, `/enumerations/issue_priorities.json`, `/enumerations/time_entry_activities.json`.

Por proyecto, al entrar o al necesitarlo (lazy):

- `GET /projects/:id.json?include=trackers,issue_categories,issue_custom_fields,time_entry_activities,enabled_modules`
- `GET /projects/:id/memberships.json`: personas asignables.
- `GET /projects/:id/versions.json`.

## Permisos

```ts
can(projectId, permission): boolean
```

- `admin === true` → todo permitido.
- Si no, permisos del proyecto = unión de los `permissions` de los roles de sus membresías (directas y vía grupos).
- Además, el **módulo** debe estar habilitado en el proyecto (`enabled_modules`): `log_time` requiere `time_tracking`, `view_wiki_pages` requiere `wiki`, etc.
- `GET /roles/:id.json` es visible para cualquier usuario autenticado. Si falla (versión antigua o instancia restringida), se aplica el **modo degradado**: se muestran las acciones y se manejan los 403 con el mensaje de `01-arquitectura.md › Errores`, ocultando la acción tras el primer 403.

Permisos que usa la UI:

| Acción en la UI | Permiso | Módulo |
|---|---|---|
| Ver tareas | `view_issues` | `issue_tracking` |
| Crear tarea / importar Excel | `add_issues` | `issue_tracking` |
| Editar campos | `edit_issues` (o `edit_own_issues` si es autor) | `issue_tracking` |
| Comentar | `add_issue_notes` | `issue_tracking` |
| Asignar | `edit_issues` + el usuario debe ser asignable | `issue_tracking` |
| Ver tiempo | `view_time_entries` | `time_tracking` |
| Registrar tiempo | `log_time` | `time_tracking` |
| Editar tiempo propio / ajeno | `edit_own_time_entries` / `edit_time_entries` | `time_tracking` |
| Ver / editar wiki | `view_wiki_pages` / `edit_wiki_pages` | `wiki` |
| Ver / gestionar noticias | `view_news` / `manage_news` | `news` |
| Ver / subir archivos | `view_files` / `manage_files` | `files` |
| Gestionar versiones | `manage_versions` | `issue_tracking` |
| Ver y usar consultas guardadas | `save_queries` (para crear) | `issue_tracking` |

## Tareas

| Operación | Endpoint |
|---|---|
| Listar | `GET /issues.json` con filtros, `sort`, `limit` (máx. 100), `offset` |
| Detalle | `GET /issues/:id.json?include=journals,attachments,relations,children,watchers,allowed_statuses` |
| Crear | `POST /issues.json { issue: {...} }` |
| Actualizar / comentar | `PUT /issues/:id.json { issue: { notes, ... } }` |
| Borrar | `DELETE /issues/:id.json` |
| Consultas guardadas | `GET /queries.json`, luego `GET /issues.json?query_id=N&project_id=...` |

`include=allowed_statuses` (Redmine ≥ 5.0) devuelve los estados a los que el usuario puede pasar según el workflow: se usa para el selector de estado.

### Filtros → query string (lógica en `shared/redmine/filters.ts`)

| Token en la frase | Parámetro |
|---|---|
| asignadas a mí | `assigned_to_id=me` |
| asignadas a *persona* | `assigned_to_id=12` (varias: `12|15`) |
| creadas por mí | `author_id=me` |
| en *estado* | `status_id=open` · `closed` · `*` · `1|2` |
| del tracker *X* | `tracker_id=3` |
| de *proyecto* (con subproyectos) | `project_id=web` + `subproject_id=!*` para excluir |
| de la versión *X* | `fixed_version_id=7` |
| con prioridad *X* | `priority_id=4` |
| actualizadas *esta semana* | `updated_on=><2026-10-12|2026-10-18` |
| vencen *antes de* fecha | `due_date=<=2026-10-31` |
| que contienen *texto* | `subject=~texto` (Redmine ≥ 5: búsqueda por `subject` con operador `~`) |
| campo personalizado | `cf_5=valor` (solo los campos con `is_filter` del proyecto) |

Operadores de Redmine disponibles: `=`, `!`, `>=`, `<=`, `><`, `~`, `!~`, `*` (cualquiera), `!*` (ninguno). El estado de la frase se serializa en la URL de la app (`?f=...`) para poder compartir y volver atrás.

## Tiempo

| Operación | Endpoint |
|---|---|
| Listar (timesheet) | `GET /time_entries.json?user_id=me&from=2026-10-12&to=2026-10-18&limit=100` |
| Crear | `POST /time_entries.json { time_entry: { issue_id, hours, activity_id, spent_on, comments } }` |
| Editar | `PUT /time_entries/:id.json` |
| Borrar | `DELETE /time_entries/:id.json` |

`hours` admite decimales; la app acepta `1h30`, `1:30`, `1.5`, `90m` y los convierte (lógica en `shared/time/duration.ts`). Si `activity_id` se omite, Redmine usa la actividad por defecto; la app propone la última usada.

## Proyectos y versiones

- `GET /projects.json`, `GET /projects/:id.json`
- `GET /projects/:id/versions.json`, `GET /versions/:id.json`. El avance se calcula con `GET /issues.json?fixed_version_id=:id&status_id=*` agregando `done_ratio` y `estimated_hours`.
- `GET /projects/:id/memberships.json`

## Wiki, noticias y archivos

- Wiki: `GET /projects/:id/wiki/index.json`, `GET|PUT /projects/:id/wiki/:title.json` (con `version` para evitar sobrescribir cambios ajenos: Redmine responde 409).
- Noticias: `GET /news.json`, `GET /projects/:id/news.json`, `POST /projects/:id/news.json` (≥ 5.0).
- Adjuntos: `POST /uploads.json?filename=x` (body binario, `Content-Type: application/octet-stream`) → `token`, luego se adjunta en `issue.uploads` o en `POST /projects/:id/files.json`.

## Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| El formato de texto (textile / markdown / commonmark) es una opción de admin no expuesta por la API | Autodetección heurística + ajuste manual en Preferencias; render con `markdown-it` o `textile-js`, sanitizado |
| `/custom_fields.json` es solo para admin | Usar `issue_custom_fields` de `/projects/:id.json` |
| `limit` máximo 100 | Paginación con `offset`; lista virtualizada carga páginas a demanda |
| Workflow de estados por rol y tracker | `include=allowed_statuses` en el detalle; en la lista, el cambio de estado rápido abre el selector con esos estados |
| Redmines con plugins que cambian respuestas | Tipos con campos opcionales y validación Zod tolerante (`passthrough`) |
