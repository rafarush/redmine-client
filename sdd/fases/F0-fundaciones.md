# F0 · Fundaciones

**Objetivo:** dejar el proyecto listo para construir con seguridad: calidad automática, tokens aplicados, layout base y un Redmine local con datos para probar.

**Depende de:** —

## Tareas

- [x] **F0-T01** Repo y scaffold — `git init`, Nuxt 4 SPA, dependencias base, estructura de carpetas, `CLAUDE.md`, `sdd/`. · ✔ c132831
  - _Acepta:_ `pnpm install && pnpm dev` arranca; `pnpm typecheck` y `pnpm test` pasan.

- [x] **F0-T02** Lint y formato — ESLint con `@nuxt/eslint` (flat config) + Prettier o el formateador de `@nuxt/eslint`. Script `pnpm lint`. Regla que prohíbe hex sueltos en `app/components/**` (por ejemplo, `no-restricted-syntax` sobre literales `#[0-9a-f]{3,8}` en clases y estilos). · ✔ 73d35a4
  - _Depende:_ F0-T01
  - _Acepta:_ `pnpm lint` pasa en limpio; un hex en un componente produce error.
  - _Nota:_ la regla vive en `eslint-rules/no-raw-hex-color.mjs` con test en `tests/unit/`. Reconoce hex de 3, 6 u 8 dígitos, así que un id de tarea (`#4821`) no la dispara; para una excepción puntual, `eslint-disable-next-line design/no-raw-hex-color` con el motivo.

- [ ] **F0-T03** CI — GitHub Actions: `pnpm install --frozen-lockfile`, `lint`, `typecheck`, `test`, `build`. Cache de pnpm.
  - _Depende:_ F0-T02
  - _Acepta:_ un PR muestra los 4 checks en verde.

- [ ] **F0-T04** Verificador de contraste — script `scripts/check-contrast.ts` que lee `tokens.css` (claro, oscuro, alto contraste) y comprueba los pares de la tabla de `02-diseno.md › Color` (≥ 4.5:1 en texto). Se ejecuta en CI.
  - _Depende:_ F0-T01
  - _Acepta:_ bajar `content-secondary` a `#8A8F99` hace fallar el script con un mensaje que indica el par y el ratio.

- [ ] **F0-T05** Layout base — `app/layouts/default.vue` con sidebar (ocultable, `Ctrl/⌘+\`), toolbar y zona de contenido; en compacto (< 900 px) tab bar inferior. Componentes `ui/` iniciales: `Button` (primario/secundario/fantasma/solo icono con `aria-label` obligatorio por tipo), `Tooltip`, `Kbd`.
  - _Depende:_ F0-T01
  - _Acepta:_ checklist de `02-diseno.md` (teclado, claro/oscuro, 375 px y 1280 px). La sidebar recuerda si estaba oculta.

- [ ] **F0-T06** Redmine local con datos semilla — `docker/compose.dev.yml` funcionando. Script `scripts/seed-redmine.ts` que, usando la API key del admin, crea: 2 proyectos (uno con subproyecto), trackers y estados por defecto, 3 usuarios (admin, desarrollador con rol *Developer*, cliente con rol *Reporter* sin `log_time`), ~40 tareas, 2 versiones, entradas de tiempo y una página de wiki. Habilitar la API REST en Ajustes (documentar el paso).
  - _Depende:_ F0-T01
  - _Acepta:_ `docker compose ... up -d && pnpm seed` deja un Redmine navegable; README de `docker/` con las API keys de cada usuario de prueba.

- [ ] **F0-T07** Fixtures y mock de API — capturar respuestas reales del Redmine local en `tests/fixtures/*.json` y montar un mock (MSW o un handler de Nitro en test) para tests sin Docker.
  - _Depende:_ F0-T06
  - _Acepta:_ un test de ejemplo lee `/users/current.json` del mock.

- [ ] **F0-T08** Fuente de datos — empaquetar JetBrains Mono localmente (`@fontsource/jetbrains-mono` o archivo en `public/fonts`), solo pesos 400 y 600, `font-display: swap`. Sin peticiones a Google Fonts (Tauri tiene que funcionar offline).
  - _Depende:_ F0-T01
  - _Acepta:_ la clase `.data` usa la fuente local; no aparecen peticiones de red externas en DevTools.

## Definición de hecho

CI en verde con lint, typecheck, tests, build y contraste; layout base navegable con teclado; Redmine local con datos y usuarios con permisos distintos.
