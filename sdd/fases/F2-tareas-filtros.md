# F2 · Lista de tareas y filtros

**Objetivo:** la pantalla principal. Una lista rápida de tareas y la **frase de filtros** (elemento distintivo, ver `02-diseno.md`).

**Depende de:** F1

## Tareas

- [x] **F2-T01** Modelo de filtros — `shared/redmine/filters.ts`: tipo `FilterSentence` (lista de condiciones `{ field, operator, values }`), `toRedmineQuery(sentence)` según la tabla de `03-api-redmine.md › Filtros`, `toUrl` / `fromUrl` para el parámetro `?f=`, y `describe(sentence)` para el texto accesible.
  - _Depende:_ F1-T01
  - _Acepta:_ tests de ida y vuelta (URL → frase → URL); fechas relativas ("esta semana") se resuelven al consultar, no al guardar. · ✔ e2a3d24

- [ ] **F2-T02** `useIssues` — composable con vue-query: paginación por `offset` en páginas de 100, `keepPreviousData` al cambiar filtros, `sort` por columna, total visible.
  - _Depende:_ F2-T01, F1-T09
  - _Acepta:_ cambiar un filtro no deja la lista vacía mientras carga (se ve la anterior atenuada).

- [ ] **F2-T03** Lista virtualizada — `components/issues/IssueTable.vue` con TanStack Table + Virtual: columnas por defecto `#`, Asunto, Estado (icono + texto), Prioridad, Asignado, Actualizada, Horas (`.data`), botón ⏱. Columnas configurables (menú de cabecera, se guardan en Pinia persistido). Fila seleccionada resaltada de forma persistente (`lists-and-tables.md`). Navegación `J/K`, `Enter` abre detalle.
  - _Depende:_ F2-T02, F0-T05
  - _Acepta:_ 2 000 tareas con scroll fluido; teclado completo; anuncio `aria-live` "N tareas".

- [ ] **F2-T04** Frase de filtros — `components/filters/FilterSentence.vue` + `FilterToken.vue` (Popover de Reka con Listbox multi-selección con búsqueda, rango de fechas con atajos) + `AddCondition.vue`. Valores ofrecidos según catálogos y proyectos visibles; campos personalizados con `is_filter`. Un popover abierto a la vez. Atajo `/` enfoca la frase. En compacto, la frase se desplaza horizontalmente y se colapsa en "N filtros ▾".
  - _Depende:_ F2-T01, F1-T06
  - _Acepta:_ checklist de diseño; lector de pantalla anuncia la frase como grupo; `Retroceso` sobre un token lo quita; atrás/adelante del navegador recorre los cambios.

- [ ] **F2-T05** Vistas predefinidas en la sidebar — "Mis tareas" (asignadas a mí, abiertas), "Creadas por mí", "Todas las abiertas", "Vencen esta semana". Son frases predefinidas, editables en la lista.
  - _Depende:_ F2-T04
  - _Acepta:_ cada vista es un enlace con `?f=` (abrir en otra pestaña funciona).

- [ ] **F2-T06** Filtros guardados — guardar la frase actual con nombre (local, Pinia persistido) y mostrar las consultas guardadas de Redmine (`/queries.json`) en la sidebar, en "Filtros guardados". Las de Redmine se aplican con `query_id` y se muestran como frase de solo lectura con "Duplicar como frase editable".
  - _Depende:_ F2-T05
  - _Acepta:_ una consulta pública de Redmine aparece y filtra igual que en Redmine.

- [ ] **F2-T07** Búsqueda global (command palette) — `Ctrl/⌘+K`: busca tareas por `#id` o texto (`subject=~`), proyectos por nombre y comandos ("Nueva tarea", "Registrar tiempo en…", "Ir a Tiempo"). Búsquedas recientes con opción de borrarlas (`searching.md`).
  - _Depende:_ F2-T02
  - _Acepta:_ `#4821` + Enter abre la tarea; el alcance de búsqueda está indicado en el placeholder.

- [ ] **F2-T08** Cambio rápido en la fila — menú contextual (clic derecho y botón "…"): cambiar estado, asignar, prioridad, copiar enlace, abrir en Redmine. Solo opciones permitidas (`<Can>`), estados según `allowed_statuses`. Guardado optimista + toast con "Deshacer".
  - _Depende:_ F2-T03, F1-T07
  - _Acepta:_ si Redmine rechaza el cambio (workflow), la fila vuelve a su estado y el toast explica el motivo.

- [ ] **F2-T09** Estados vacío, cargando y error — skeleton de filas; vacío con sugerencia de quitar el filtro más restrictivo (`02-diseno.md › Escritura`); error de red con banner y Reintentar.
  - _Depende:_ F2-T03
  - _Acepta:_ las tres situaciones se ven en la ruta de desarrollo `/_demo/estados` (excluida del build de producción).

## Definición de hecho

Desde la lista se puede encontrar cualquier tarea en ≤ 3 interacciones, filtrar sin recarga, cambiar estado sin abrir la tarea y compartir la vista por URL. Pasa la checklist de diseño y un e2e de Playwright (filtrar → abrir → cambiar estado).
