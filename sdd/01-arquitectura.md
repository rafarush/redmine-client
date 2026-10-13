# 01 · Arquitectura

## Vista general

```
                        ┌──────────────────────── Web ────────────────────────┐
 Navegador (SPA Nuxt) ──┤  fetch /api/redmine/**  ──►  Nitro (proxy BFF)  ──► │──► Redmine REST API
                        │  cookie sellada httpOnly       allowlist de hosts    │
                        └──────────────────────────────────────────────────────┘
                        ┌────────────────────── Desktop ──────────────────────┐
 Tauri (misma SPA)  ────┤  @tauri-apps/plugin-http  ──────────────────────────►│──► Redmine REST API
                        │  API key en el llavero del SO                         │
                        └──────────────────────────────────────────────────────┘
```

En el código:

```
componente ─► composable (vue-query) ─► shared/redmine/client.ts ─► RedmineTransport ─► Redmine
                                                                     ├─ ProxyTransport (web)
                                                                     └─ TauriTransport (desktop/móvil)
```

El transport se elige al arrancar con `isTauri()`. Nada fuera de `shared/redmine/` sabe en qué plataforma corre.

## Decisiones (ADR)

### ADR-001 · Nuxt 4 en modo SPA + Tauri 2

**Decisión.** Nuxt 4 con `ssr: false`. El mismo build estático se empaqueta en Tauri para desktop y, más adelante, para iOS/Android.

**Por qué.** El equipo ya conoce Vue/Nuxt. Nitro da el proxy de la versión web en el mismo proyecto. Tauri genera binarios de ~10 MB y su plugin HTTP evita CORS en desktop.

**Alternativas consideradas.**

| Opción | Pros | Contras | Motivo de descarte |
|---|---|---|---|
| Next.js + Tauri | Ecosistema React más grande, Route Handlers como proxy | Export estático con restricciones; Next es pesado para una SPA | El equipo prefiere Vue |
| React + Vite + Hono + Tauri | SPA pura, Motion/Radix maduros | Monorepo con dos paquetes | Igual que arriba |
| Vue + Vite + Hono + Tauri | El más ligero | Monorepo; mismos contras de ecosistema que Nuxt | Nuxt ya incluye el servidor |
| Flutter | Un motor para todo | Dart nuevo; web pesada; tablas y Excel cuestan más | Curva y calidad web |
| Electron + Capacitor | Muy maduros | Dos empaquetadores; ~150 MB | Peso y mantenimiento |

**Consecuencias.** Sin SSR ni rutas de servidor dentro de Tauri: todo lo que dependa de Nitro tiene que tener equivalente en el transport de Tauri. El ecosistema de componentes de Vue es más chico: se compensa con Reka UI.

### ADR-002 · Proxy BFF en Nitro para la versión web

**Decisión.** La SPA web llama a `/api/redmine/**`. Nitro reenvía a Redmine con `X-Redmine-API-Key`.

**Por qué.** Redmine no envía cabeceras CORS por defecto, así que el navegador no puede llamarlo directamente. El proxy, además, saca la API key del navegador.

**Detalles.**
- `POST /api/session/login { url, apiKey }`: valida contra `/users/current.json`, guarda `{ url, apiKey }` en la sesión sellada (`nuxt-auth-utils`, cookie httpOnly, `SameSite=Lax`, `Secure` en producción).
- `GET /api/session/me`: devuelve el usuario sin la key. `POST /api/session/logout`: borra la sesión.
- `ALL /api/redmine/[...path]`: comprueba que el host de la sesión esté en `NUXT_REDMINE_ALLOWED_HOSTS` (**evita SSRF**), reenvía método, query, body y `Content-Type` (incluido `application/octet-stream` para `/uploads.json`), y propaga el status y los `errors` de Redmine.
- Solo reenvía rutas que terminan en `.json` o `/uploads.json`/descargas de adjuntos; el resto devuelve 404.

**Contras aceptados.** Hay que desplegar y mantener un servicio (Docker, ADR-007).

### ADR-003 · Desktop habla directo con Redmine

**Decisión.** En Tauri se usa `@tauri-apps/plugin-http` hacia la URL del usuario. La API key se guarda en el llavero del SO (`tauri-plugin-keyring`; si no está disponible en la plataforma, `stronghold`).

**Por qué.** Sin dependencia del servidor web; funciona contra Redmines de red interna.

**Consecuencias.** El scope de `plugin-http` se configura en tiempo de ejecución con el host que el usuario configuró (ver F8-T03). Dos implementaciones del transport, con la misma batería de tests de contrato.

### ADR-004 · Estado: vue-query para el servidor, Pinia para la app

- **vue-query** cachea todo lo que viene de Redmine. Claves: `['issues', filtrosNormalizados]`, `['issue', id]`, `['catalog', 'trackers']`, etc.
  - Catálogos (trackers, estados, prioridades, actividades): `staleTime` 1 h.
  - Listas de tareas: `staleTime` 30 s, refetch al enfocar la ventana.
  - Mutaciones optimistas para registrar tiempo y cambiar estado, con rollback si Redmine responde error.
- **Pinia**: sesión (usuario, permisos), preferencias (filtros guardados localmente, columnas visibles), borradores de diálogos.

### ADR-005 · UI: Tailwind v4 + Reka UI + Lucide

- Reka UI da primitivas accesibles sin estilo (Dialog, Popover, Combobox, Menu, Tooltip, Toast). Se envuelven en `app/components/ui/` con los tokens.
- Los componentes de shadcn-vue se pueden copiar como punto de partida, pero se ajustan a los tokens de `02-diseno.md`.
- Iconos Lucide vía `@nuxt/icon` (bundle local, sin pedir a la red en runtime: necesario para Tauri offline).

### ADR-006 · Excel con exceljs y plantilla fija

- **Generar** la plantilla en el navegador por proyecto: hoja `Tareas` con las columnas fijas y hojas ocultas con las listas válidas (trackers, estados, prioridades, miembros asignables, versiones, categorías), con validación de datos (desplegables).
- **Importar** solo archivos que vengan de esa plantilla: se comprueba la hoja `Tareas`, las cabeceras y la versión de plantilla (celda oculta `_meta`).
- exceljs en vez de SheetJS porque la edición community de SheetJS no escribe validaciones de datos.

### ADR-007 · Despliegue web con Docker

Imagen Node 22 con `.output` de Nitro (`docker/Dockerfile`), detrás del proxy inverso de la empresa con HTTPS. `NUXT_SESSION_PASSWORD` y `NUXT_REDMINE_ALLOWED_HOSTS` por entorno. Si más adelante Redmine es accesible desde internet, Nitro permite cambiar de preset (Vercel, Cloudflare) sin tocar código.

## Seguridad

| Riesgo | Mitigación |
|---|---|
| Robo de API key en el navegador | No se guarda en JS: cookie sellada httpOnly (web) o llavero del SO (desktop) |
| SSRF vía proxy | Allowlist de hosts; solo rutas de la API de Redmine |
| CSRF | `SameSite=Lax` + el proxy exige `Content-Type: application/json` o una cabecera propia (`X-Requested-With`) en métodos que escriben |
| XSS al renderizar textile/markdown de Redmine | Sanitizar el HTML generado (DOMPurify) antes de mostrarlo |
| Fugas en logs | El proxy nunca loguea la key ni el body |

## Errores

`RedmineError(status, errors[])`:

| Status | Qué ve el usuario |
|---|---|
| 401 | "Tu API key ya no es válida. Pega una nueva para seguir." → pantalla de conexión con la URL rellenada |
| 403 | "No tienes permiso para esto en *Proyecto X*." Refresca los permisos en segundo plano |
| 404 | "La tarea #123 no existe o ya no tienes acceso." |
| 422 | Los `errors` de Redmine junto al campo correspondiente cuando se pueden mapear; si no, arriba del formulario |
| Red | Banner no bloqueante "Sin conexión con Redmine" con botón Reintentar; la caché sigue visible |
