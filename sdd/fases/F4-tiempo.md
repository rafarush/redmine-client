# F4 · Registrar tiempo y timesheet

**Objetivo:** registrar tiempo en ≤ 5 s desde donde esté la tarea, y ver o corregir la semana de un vistazo.

**Depende de:** F2 (F3 para el popover en el detalle)

## Tareas

- [ ] **F4-T01** Parser de duraciones — `shared/time/duration.ts`: `parseDuration(texto) → horas | error` y `formatHours(h)`. Acepta `1h30`, `1h 30m`, `1:30`, `1.5`, `1,5`, `90m`, `2h`, `45`. Para un número suelto, ≤ 12 se toma como horas y > 12 como minutos, mostrando siempre la interpretación. Rechaza 0, negativos y > 24 h.
  - _Nota:_ adelantado en F2c-T02 (`parseDuration`, `roundHours`, `formatDuration`, `formatClock`); falta mostrar la interpretación en el popover.
  - _Acepta:_ tabla de tests con todos los formatos y casos límite.

- [ ] **F4-T02** `useTimeEntries` — consultas por tarea y por rango (`user_id=me`, `from`, `to`), y mutación de crear/editar/borrar con actualización optimista de las horas de la tarea en la caché de la lista y del detalle.
  - _Depende:_ F1-T09
  - _Acepta:_ tras crear, la fila muestra las horas nuevas sin refetch; si falla, vuelve atrás.

- [ ] **F4-T03** Popover "Registrar tiempo" — `components/time/LogTimePopover.vue` según `02-diseno.md › El popover de tiempo`: foco en duración con conversión visible, chips con las 3 actividades más usadas por proyecto, fecha "Hoy" con atajos (Ayer, selector), comentario opcional, Enter registra. Borrador por tarea si se cierra solo (`popovers.md`). Solo visible con `log_time` (`<Can>`). Anclado al ⏱ de la fila y al botón del detalle; atajo `T`.
  - _Depende:_ F4-T01, F4-T02, F2-T03, F1-T07
  - _Acepta:_ registrar 1h30 en una tarea de la lista con teclado: `T`, `1h30`, `Enter` (3 interacciones); toast "Tiempo registrado · Deshacer"; el Deshacer borra la entrada.

- [ ] **F4-T04** El momento de movimiento — roll numérico de las horas en la fila y pulso del ⏱ al registrar, con motion-v (`02-diseno.md › Movimiento`). Desactivado con reduced motion.
  - _Depende:_ F4-T03
  - _Acepta:_ con `prefers-reduced-motion: reduce` el número cambia sin animación; la animación no bloquea abrir otro popover.

- [ ] **F4-T05** Temporizador — botón ▶ en la fila y en el detalle: un único temporizador activo, visible en la toolbar ("#4821 · 00:32:10") y persistido (sobrevive a recargar). Al detenerlo abre el popover prellenado con la duración redondeada (preferencia: 5 / 15 min).
  - _Depende:_ F4-T03
  - _Acepta:_ iniciar otro temporizador pregunta si detener el actual; cerrar la app y volver mantiene el tiempo.

- [ ] **F4-T06** Timesheet semanal — vista "Tiempo" en la sidebar: filas = tareas con tiempo en la semana (más "Añadir tarea"), columnas = días, total por día y por semana (`.data`). Edición por celda (escribir duración y Enter; varias entradas en una celda se muestran desglosadas en un popover). Navegación de semana ← →, "Esta semana". Objetivo diario configurable (p. ej. 8 h) con la barra de total en `signal-success` / `signal-warning` + texto.
  - _Depende:_ F4-T02, F4-T01
  - _Acepta:_ navegar con flechas entre celdas; editar una celda con una sola entrada la actualiza; con varias, abre el desglose.

- [ ] **F4-T07** Lista de entradas — debajo del timesheet o en pestaña: entradas del rango con editar/borrar según `edit_own_time_entries` / `edit_time_entries`; borrar con confirmación (`AlertDialog`) solo si no hay Deshacer posible.
  - _Depende:_ F4-T06
  - _Acepta:_ un usuario sin `edit_time_entries` no ve acciones sobre entradas ajenas.

## Definición de hecho

Las métricas de `00-vision.md` para registrar tiempo se cumplen y se verifican en un e2e. El timesheet cuadra con el informe de tiempo de Redmine para la misma semana y usuario.
