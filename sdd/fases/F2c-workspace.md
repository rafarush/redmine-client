# F2c · Workspace

**Objetivo:** la pantalla de inicio pasa a ser un espacio de trabajo personal: listas (boards) de tareas **asignadas a mí**, ordenadas por prioridad y fecha fin, con acciones rápidas sobre cada card. La lista actual se mueve a `/issues`.

**Depende de:** F2b-T06 (F2b-T07, el cierre visual, se hace al terminar esta fase)

## Decisiones

- Todo cambio va a Redmine al momento (no hay estados solo locales). Se reutiliza `useIssueChange` (optimista + deshacer).
- Disposición y temporizadores se guardan en `localStorage` (`redmine-client:workspace`, `:timers`); nunca la API key.
- "Categoría" = agrupación local de proyectos definida por el usuario.
- Candado: cerrado = rejilla reordenable con encaje; abierto = canvas libre (x/y, pan). En compacto, siempre una columna.

## Tareas

- [x] **F2c-T01** Modelo y orden — `shared/workspace/model.ts` (Workspace, Board, Category), `sort.ts` (prioridad desc, fecha fin asc, sin fecha al final).
  - _Acepta:_ tests unitarios. · ✔ e2a1c35

- [x] **F2c-T02** Flujo de la card — `shared/workspace/flow.ts`: `idle → in_progress → done → rtqa`, cálculo del tiempo (`ahora − startedAt`), mapeo a estados de Redmine con valores por defecto adivinados por nombre. `shared/time/duration.ts` (lectura, formato y redondeo; adelanta F4-T01).
  - _Acepta:_ tests unitarios. · ✔ 0b7dbd0

- [x] **F2c-T03** Cliente: `updateTimeEntry` (PUT `/time_entries/:id.json`) en `client.ts` y en el contrato del transport.
  - _Acepta:_ test del contrato. · ✔ a779275

- [ ] **F2c-T04** Store y rutas — `stores/workspace.ts` persistido; `/` = Workspace, `/issues` = lista (redirección de `/?f=`); Workspace primera sección en `useNavItems`.
  - _Depende:_ F2c-T01
  - _Acepta:_ e2e de layout actualizados; abrir `/?f=…` lleva a `/issues?f=…`.

- [ ] **F2c-T05** Boards — `useBoardIssues(board)` (asignadas a mí, abiertas, por proyecto); componente Board con menú (renombrar, abrir kanban, quitar con deshacer) y "+ Añadir" (proyecto, categoría, lista).
  - _Depende:_ F2c-T04

- [ ] **F2c-T06** Card y acciones rápidas — `issues/IssueCard.vue`: doble clic → "En curso" + cronómetro; doble clic → "Completada" + entrada de tiempo; botón RTQA; icono de cronómetro → Dialog para ajustar o añadir tiempo; ▲▼ cambian prioridad (Alt+↑/↓) y la lista se reordena con animación. Un solo temporizador activo. Ajustes del workspace para mapear los tres estados.
  - _Depende:_ F2c-T02, F2c-T03, F2c-T05
  - _Acepta:_ verificado contra el Redmine local; acciones protegidas con `<Can>`; un estado no permitido revierte y explica.

- [ ] **F2c-T07** Canvas con candado — rejilla reordenable (`vue-draggable-plus`) y canvas libre (pointer events + pan); `shared/workspace/layout.ts` (encaje, colisiones, conversión libre↔rejilla) con tests; mover boards con teclado.
  - _Depende:_ F2c-T05

- [ ] **F2c-T08** e2e `workspace.spec.ts` (1280 y 375).
  - _Depende:_ F2c-T06, F2c-T07

## Definición de hecho

Desde el workspace se lleva una tarea de "nueva" a RTQA con tiempo registrado sin salir de la pantalla, y la disposición sobrevive a una recarga.
