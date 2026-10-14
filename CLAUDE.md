# CLAUDE.md

Cliente de Redmine (web + desktop, móvil después) con una UX más simple que la de Redmine. Usa la REST API de Redmine 5.x/6.x con la API key del usuario y solo muestra las acciones que ese usuario puede hacer.

## Cómo se trabaja aquí: SDD

El plan vive en `sdd/`. **Antes de escribir código, lee `sdd/README.md` y la fase en curso en `sdd/fases/`.**

- Toma la primera tarea `[ ]` cuyas dependencias estén en `[x]`. Márcala `[~]` al empezar.
- Al terminar, márcala `[x]` y añade ` · ✔ <hash corto>` con el commit que la cierra.
- Si una tarea cambia una decisión de `sdd/01-arquitectura.md` o `sdd/02-diseno.md`, actualiza ese documento en el mismo commit.
- No inventes tareas fuera del plan sin anotarlas en la fase correspondiente.

## Stack

| Capa | Tecnología |
|---|---|
| App | Nuxt 4, `ssr: false` (SPA). Código en `app/` |
| Proxy web | Nitro, `server/api/redmine/[...path].ts` + sesión sellada (`nuxt-auth-utils`) |
| Desktop / móvil | Tauri 2 (`src-tauri/`, fase F8; requiere Rust) |
| UI | Tailwind v4 + Reka UI (primitivas accesibles), iconos Lucide (`<Icon name="lucide:..."/>`) |
| Animación | `motion-v` |
| Datos | `@tanstack/vue-query` (caché del servidor), Pinia (estado de la app), Zod + vee-validate (formularios) |
| Tablas | `@tanstack/vue-table` + `@tanstack/vue-virtual` |
| Excel | `exceljs` (generar plantilla e importar) |
| Tests | Vitest + @nuxt/test-utils (`tests/unit`), Playwright (`tests/e2e`) |

## Comandos

```sh
pnpm install
pnpm dev            # http://localhost:3000
pnpm lint           # ESLint + formato (@stylistic); pnpm lint:fix para corregir
pnpm typecheck
pnpm test           # unitarios
pnpm test:e2e       # Playwright en 1280 y 375 px; levanta el dev server solo
pnpm check:contrast # contrastes de la paleta en los 4 modos
pnpm build          # SPA + servidor Nitro (.output)

docker compose -f docker/compose.dev.yml up -d   # Redmine local en :3080
pnpm seed           # datos de prueba y claves de API (ver docker/README.md)
```

Copia `.env.example` a `.env` antes de `pnpm dev`.

## Arquitectura en una línea

`componente -> composable (vue-query) -> shared/redmine/client.ts -> RedmineTransport (proxy | tauri) -> Redmine`

- **Nunca** hagas `fetch` a Redmine desde un componente. Todo pasa por el cliente y el transport (`shared/redmine/transport.ts`).
- **Nunca** guardes la API key en `localStorage` o `sessionStorage`. En web vive en la cookie sellada; en desktop, en el llavero del SO.
- Cada acción de la UI se protege con el permiso de Redmine correspondiente. Si el usuario no puede hacerla, se oculta, no se deshabilita. Excepción: si ocultarla confundiría, se deshabilita con una explicación.
- El proxy solo llama a hosts de `NUXT_REDMINE_ALLOWED_HOSTS`.

### Permisos en la UI: `<Can>` y `v-can`

```vue
<!-- Se oculta si el usuario no puede registrar tiempo en ese proyecto. -->
<Can permission="log_time" :project="issue.project.id">
  <TimeLogButton :issue="issue" />
</Can>

<!-- Visible pero apagado, con el motivo: para cuando esconderlo confundiría. -->
<Can permission="log_time" :project="issue.project.id" mode="disabled" v-slot="{ allowed, reason }">
  <UiButton label="Registrar tiempo" :disabled="!allowed" :title="reason" />
</Can>

<!-- Directiva, para un solo elemento. Sin proyecto, basta con poder en alguno. -->
<UiButton v-can="'add_issues'" label="Nueva tarea" />
<UiButton v-can="{ permission: 'log_time', project: issue.project.id }" label="Registrar tiempo" />
<UiButton v-can.disabled="'log_time'" label="Registrar tiempo" />
```

Los dos consultan `useSessionStore().can(permission, projectId?)`, que a su vez usa
`shared/redmine/permissions.ts`. En `mode="disabled"` / `.disabled` el motivo sale de
`app/utils/can.ts`.

## Reglas de diseño (detalle en `sdd/02-diseno.md`)

- Colores **solo** desde tokens (`app/assets/css/tokens.css` -> `bg-surface`, `text-secondary`, `bg-accent`...). La regla `design/no-raw-hex-color` (`eslint-rules/`) rechaza cualquier hex en `app/`, `shared/`, `server/` y en los `.css` que no sean `tokens.css`, incluidos los bloques `<style>` y los valores arbitrarios de Tailwind (`bg-[#fff]`).
- El acento Ruby se usa solo en la acción primaria y en el foco. El estado se comunica con icono + texto, nunca solo con color.
- Tipografía del sistema para la UI; clase `.data` (mono tabular) para `#ID`, horas y fechas.
- Las acciones frecuentes no salen de la lista: registrar tiempo es un **Popover**, crear tarea es un **Dialog**, los filtros son tokens con popover. Un solo modal a la vez.
- Motion: solo el momento definido en el diseño (horas que suben al guardar tiempo) y transiciones de entrada/salida de popovers/dialogs. Respeta `prefers-reduced-motion`.
- Todo botón con solo icono lleva `aria-label`. Todo lo interactivo funciona con teclado y tiene foco visible.
- Textos en español, en voz activa, y el verbo dice lo que pasa ("Registrar tiempo", no "Enviar"). El toast repite el verbo ("Tiempo registrado").
- Para revisar una pantalla, usa la skill `apple-design`; para animaciones, `motion-framer` (traduce los ejemplos de React a `motion-v`).

## Convenciones

- TypeScript estricto. Tipos de Redmine en `shared/redmine/types.ts`.
- **Código en inglés**: nombres de variable, función, tipo, archivo y ruta de página (`/connect`, `/projects`, `/time`). Los comentarios, la documentación y los textos de la interfaz siguen en español.
- Composables `useX` en `app/composables/`; un composable por recurso (`useIssues`, `useTimeEntries`...).
- Componentes por dominio: `app/components/{issues,time,filters,import,layout,ui}/`. `ui/` son envoltorios de Reka UI con los tokens aplicados.
- Toda lógica pura (parseo de duraciones, filtros -> query string, validación de filas Excel, permisos) va en `shared/` y lleva test unitario.
- Commits en español, en imperativo y con el id de tarea: `F2-T03: barra de filtros como frase`.
