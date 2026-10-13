# F1 · Conexión, sesión y permisos

**Objetivo:** el usuario pega la URL de su Redmine y su API key, y la app carga su perfil, sus proyectos y lo que puede hacer en cada uno. A partir de aquí ninguna pantalla muestra acciones no permitidas.

**Depende de:** F0

## Tareas

- [ ] **F1-T01** Tipos y cliente — `shared/redmine/types.ts` (User, Membership, Role, Project, Tracker, IssueStatus, Priority, Activity, Issue, Journal, TimeEntry, Version, WikiPage, News, Attachment, Paginated<T>) con esquemas Zod tolerantes. `shared/redmine/client.ts`: métodos tipados sobre un `RedmineTransport` (`getCurrentUser`, `getRole`, `listProjects`, ...), paginación automática para catálogos y mapeo a `RedmineError`.
  - _Depende:_ F0-T07
  - _Acepta:_ tests unitarios contra fixtures; un 422 de Redmine produce `RedmineError` con `errors[]`.

- [ ] **F1-T02** Proxy y sesión en Nitro — `server/api/session/{login,logout,me}.ts` y `server/api/redmine/[...path].ts` según `01-arquitectura.md › ADR-002` (sesión sellada, allowlist de hosts, solo rutas de API, reenvío de binarios para `/uploads.json`, sin loguear la key).
  - _Depende:_ F1-T01
  - _Acepta:_ tests de servidor: host fuera de la allowlist → 403; sin sesión → 401; `login` con una key mala → 401 con el mensaje de Redmine; la cookie es `httpOnly`; la key no aparece en `/api/session/me`.

- [ ] **F1-T03** ProxyTransport — implementación web de `RedmineTransport` sobre `$fetch('/api/redmine/...')`. Plugin `app/plugins/redmine.client.ts` que elige el transport con `isTauri()` y provee el cliente (`useRedmine()`).
  - _Depende:_ F1-T02
  - _Acepta:_ test de contrato compartido (`tests/unit/transport.contract.ts`) que pasa con ProxyTransport y que luego reutilizará TauriTransport.

- [ ] **F1-T04** Pantalla de conexión — `pages/conectar.vue`: campos *URL de Redmine* y *API key* (tipo password con botón mostrar/ocultar), ayuda inline "Encuéntrala en Redmine → Mi cuenta → Clave de acceso a la API" con enlace directo a `<url>/my/account`, botón primario "Conectar". Normaliza la URL (quita `/` final, añade `https://` si falta). Errores en el campo: URL inalcanzable, la API REST no está habilitada (respuesta 403/HTML), key inválida.
  - _Depende:_ F1-T03, F0-T05
  - _Acepta:_ conectar con el usuario *desarrollador* del Redmine local lleva a la lista; cada error tiene un texto específico (`02-diseno.md › Escritura`); no hay pasos extra ni tutorial obligatorio (`onboarding.md`).

- [ ] **F1-T05** Permisos — `shared/redmine/permissions.ts`: `buildPermissionMap(user, roles, projects)` y `can(map, projectId, permission)`, incluyendo admin, grupos, y módulos habilitados. Modo degradado si `/roles/:id.json` falla (ver `03-api-redmine.md › Permisos`).
  - _Depende:_ F1-T01
  - _Acepta:_ tests: *Reporter* no tiene `log_time`; un proyecto sin módulo `time_tracking` niega `log_time` aunque el rol lo tenga; admin puede todo; el modo degradado se activa con un 403 en roles.

- [ ] **F1-T06** Store de sesión y arranque — Pinia `useSessionStore`: usuario, `permissionMap`, catálogos globales; carga en el orden de `03-api-redmine.md › Arranque` con peticiones paralelas. Middleware de ruta: sin sesión → `/conectar`. Skeleton mientras carga (sin spinners a pantalla completa).
  - _Depende:_ F1-T04, F1-T05
  - _Acepta:_ recargar la app con sesión válida lleva directo a la lista; con key revocada lleva a `/conectar` con la URL rellenada y el mensaje de 401.

- [ ] **F1-T07** `<Can>` y `v-can` — componente y directiva que muestran su contenido solo si `can(projectId, permission)`. Modo `disabled` opcional con tooltip explicativo.
  - _Depende:_ F1-T06
  - _Acepta:_ test de componente; documentado en `CLAUDE.md` con un ejemplo.

- [ ] **F1-T08** Menú de cuenta — en la sidebar: avatar/iniciales, nombre, host de Redmine, "Abrir en Redmine", "Preferencias", "Desconectar". Desconectar borra la sesión y la caché de vue-query.
  - _Depende:_ F1-T06
  - _Acepta:_ tras desconectar, el botón atrás del navegador no muestra datos cacheados.

- [ ] **F1-T09** vue-query — plugin con `QueryClient` y defaults de `01-arquitectura.md › ADR-004`; manejo global de 401 (vuelve a `/conectar`) y 403 (refresca permisos).
  - _Depende:_ F1-T03
  - _Acepta:_ simular 401 en una consulta lleva a `/conectar` una sola vez (sin bucles).

## Definición de hecho

Con el usuario *Reporter* del Redmine local no aparece ningún control de registrar tiempo; con *Developer* sí. La API key no aparece en `localStorage`, `sessionStorage`, IndexedDB ni en respuestas JSON al navegador.
