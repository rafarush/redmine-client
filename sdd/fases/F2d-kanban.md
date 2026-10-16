# F2d · Kanban

**Objetivo:** cada board del workspace se puede abrir como kanban, agrupado por estado, por sprint o por estado×sprint, moviendo tareas entre columnas.

**Depende de:** F2c

## Decisiones

- Sprint = versión objetivo (`fixed_version`). Columna "Sin sprint" para las tareas sin versión.
- Las cards son las mismas que en el workspace (`issues/IssueCard.vue`).

## Tareas

- [x] **F2d-T01** Agrupación — `shared/kanban/group.ts`: por estado (orden del catálogo), por versión, y matriz estado×versión.
  - _Acepta:_ tests unitarios. · ✔ 05e7f0f

- [x] **F2d-T02** Cambio de versión — ampliar `IssueChange`, `applyChange` y `toRedminePayload` (`shared/redmine/issue-actions.ts`) con `fixed_version_id`.
  - _Acepta:_ tests unitarios; deshacer devuelve la versión anterior. · ✔ 087be34

- [ ] **F2d-T03** Vista kanban — `/board/:id/kanban`, `SegmentedControl` Estado · Sprint · Estado/Sprint con el modo en la URL (`?by=`); columnas con versiones abiertas (`listVersions`).
  - _Depende:_ F2d-T01

- [ ] **F2d-T04** Mover tareas — arrastrar entre columnas (`vue-draggable-plus`) cambia estado o versión vía `useIssueChange`; destino no permitido (`allowed_statuses`) se rechaza y explica; alternativa con menú "Mover a…" y teclado.
  - _Depende:_ F2d-T02, F2d-T03
  - _Acepta:_ verificado contra el Redmine local.

- [ ] **F2d-T05** e2e `kanban.spec.ts`.
  - _Depende:_ F2d-T04

## Definición de hecho

Una tarea se puede mover de estado y de sprint desde el kanban, con ratón y con teclado, y el cambio se ve en Redmine.
