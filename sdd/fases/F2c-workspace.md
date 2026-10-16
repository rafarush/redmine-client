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

- [x] **F2c-T04** Store y rutas — `stores/workspace.ts` persistido; `/` = Workspace, `/issues` = lista (redirección de `/?f=`); Workspace primera sección en `useNavItems`.
  - _Depende:_ F2c-T01
  - _Acepta:_ e2e de layout actualizados; abrir `/?f=…` lleva a `/issues?f=…`. · ✔ 615cdee

- [x] **F2c-T05** Boards — `useBoardIssues(board)` (asignadas a mí, abiertas, por proyecto); componente Board con menú (renombrar, abrir kanban, quitar con deshacer) y "+ Añadir" (proyecto, categoría, lista).
  - _Depende:_ F2c-T04 · ✔ 4bebafa
  - _Nota:_ franja de salidas (fecha, en curso + cronómetro, pendientes, para hoy, registrado hoy) y vacío con proyectos sugeridos. La consulta de cada board lleva la clave `['issues', 'board', …]` con forma `{ pages }` para que `useIssueChange` la parchee.

- [~] **F2c-T06** Card y acciones rápidas — `issues/IssueCard.vue`: doble clic → "En curso" + cronómetro; doble clic → "Completada" + entrada de tiempo; botón RTQA; icono de cronómetro → Dialog para ajustar o añadir tiempo; ▲▼ cambian prioridad (Alt+↑/↓) y la lista se reordena con animación. Un solo temporizador activo. Ajustes del workspace para mapear los tres estados.
  - _Depende:_ F2c-T02, F2c-T03, F2c-T05
  - _Acepta:_ verificado contra el Redmine local; acciones protegidas con `<Can>`; un estado no permitido revierte y explica.
  - _Hecho:_ 816adee. Falta la verificación contra el Redmine local (la hace F2c-T08). `useIssueChange` gana `onUndo` y `changeAsync`; deshacer "completar" borra el registro de tiempo y repone el cronómetro. Cambiar de cronómetro pregunta (descartar o cancelar) en vez de perder el tiempo en silencio.

- [~] **F2c-T07** Canvas con candado — rejilla reordenable (`vue-draggable-plus`) y canvas libre (pointer events + pan); `shared/workspace/layout.ts` (encaje, colisiones, conversión libre↔rejilla) con tests; mover boards con teclado.
  - _Depende:_ F2c-T05
  - _Hecho:_ ef22d53 (`vue-draggable-plus` para la rejilla; arrastre propio con pointer events y encaje de 8 px en el lienzo libre, que muestra la rejilla de construcción). Sin `layout.ts` aparte: cada board guarda sus dos disposiciones (orden + ancho en la rejilla, x/y/ancho en el lienzo), así que no hace falta convertir ni resolver colisiones; el lienzo encaja a 8 px. Pendiente de verificar a mano.

- [~] **F2c-T08** e2e `workspace.spec.ts` (1280 y 375).
  - _Depende:_ F2c-T06, F2c-T07

- [~] **F2c-T09** Cronómetro con pausa y parada (pedido del usuario, 2026-10-15) — cada tarea tiene su cronómetro y solo uno corre: arrancar o reanudar otro pausa el anterior (sustituye al diálogo de "ya hay un cronómetro"). En la card, un botón ⏸/▶ que alterna (P) y ⏹ (S) que registra en Redmine lo medido y cierra el cronómetro; la tarea sigue en curso. Mientras corre o está en pausa, todo es local. El segundo doble clic sigue completando y registrando lo que quede.
  - _Depende:_ F2c-T06
  - _Acepta:_ tests unitarios de `pauseTimer`/`resumeTimer`/`runOnly` y migración del formato anterior; e2e de pausar, reanudar y parar.

- [~] **F2c-T10** Clic y menú contextual (pedido del usuario, 2026-10-15) — en el workspace, un clic abre el detalle de la tarea (el doble clic sigue avanzando el flujo; el clic espera ~260 ms para distinguirlos). En toda la app, clic derecho / tecla Menú / Mayús+F10 sobre una tarea abre un menú propio (`IssueContextMenu`, una instancia en el layout): ver detalles, iniciar/pausar/reanudar, parar y registrar, registrar tiempo…, ajustar el último registro, cambiar estado (según `allowed_statuses`), prioridad, asignar, mover a sprint, editar en Redmine, copiar enlace y abrir en Redmine, con los atajos a la derecha.
  - _Depende:_ F2c-T09, F3-T01
  - _Acepta:_ e2e de clic → detalle y clic derecho → menú; la lista y el kanban usan el mismo menú.

- [~] **F2c-T11** Lista con buscador de tareas (pedido del usuario, 2026-10-15) — en "Añadir board" de tipo Lista, un selector con búsqueda por `#número` o por asunto y marcado múltiple (`workspace/IssueMultiPicker.vue`) sustituye al campo de números. El menú "…" de una lista gana "Añadir tareas" (reabre el diálogo solo con el selector) y el menú contextual de una tarea, dentro de una lista, gana "Quitar de esta lista" con deshacer.
  - _Depende:_ F2c-T05, F2c-T10
  - _Nota:_ una lista muestra las tareas elegidas sean de quien sean (se quita `assigned_to_id=me`; sigue siendo solo abiertas).
  - _Acepta:_ tests unitarios de `addIssuesToBoard`/`removeIssueFromBoard` y de la consulta de una lista.

- [ ] **F2c-T12** Ajustes del workspace por categorías y atajos personalizables (pedido del usuario, 2026-10-15) — el diálogo de ajustes pasa a ser más grande con dos categorías: "Integración con Redmine" (lo de ahora: mapeo de estados) y "Atajos de teclado". Atajos por defecto: Alt+T nueva tarea (Ctrl+T lo intercepta el navegador, se puede elegir en ajustes con aviso), Ctrl+B nuevo board y Ctrl+L candado; estos dos solo actúan en el workspace. `shared/shortcuts/keymap.ts` con tests (combinación, conflictos, reservados del navegador), `stores/shortcuts.ts` persistido en `localStorage`.
  - _Depende:_ F2c-T06
  - _Acepta:_ tests unitarios; los atajos nuevos salen en la hoja de atajos (`?`) y en los tooltips; cambiar un atajo sobrevive a una recarga.

## Definición de hecho

Desde el workspace se lleva una tarea de "nueva" a RTQA con tiempo registrado sin salir de la pantalla, y la disposición sobrevive a una recarga.
