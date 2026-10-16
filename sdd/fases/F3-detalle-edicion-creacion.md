# F3 · Detalle, edición y creación de tareas

**Objetivo:** ver y editar una tarea sin perder la lista de vista, y crear tareas en un diálogo corto.

**Depende de:** F2

## Tareas

- [~] **F3-T01** Panel de detalle — split view a la derecha de la lista en desktop (ancho redimensionable y recordado), vista apilada en compacto. Ruta `/tareas/:id` (enlace directo). Cabecera: `#id` (`.data`), asunto, proyecto › tracker, botón "Abrir en Redmine".
  - _Depende:_ F2-T03
  - _Acepta:_ abrir otra tarea desde la lista reemplaza el panel sin recargar; `Esc` cierra el panel y devuelve el foco a la fila.
  - _Nota (2026-10-15):_ adelantada una primera versión como página `/issues/:id` (código en inglés, ver CLAUDE.md), para el clic del workspace (F2c-T10): cabecera, cronómetro y flujo, descripción en texto plano, comentarios y datos. Falta el split view junto a la lista, `Esc` y recordar el ancho.

- [ ] **F3-T02** Edición inline de campos — estado (con `allowed_statuses`), asignado, prioridad, versión, categoría, fechas, estimación, % hecho y campos personalizados según tipo (lista, fecha, número, booleano, usuario, texto). Cada campo se guarda solo, con indicador "Guardado" y Deshacer. Campos sin permiso de edición se muestran como texto.
  - _Depende:_ F3-T01, F1-T07
  - _Acepta:_ errores 422 aparecen junto al campo; un usuario con `edit_own_issues` solo edita las suyas.

- [ ] **F3-T03** Descripción y formato de texto — render de textile o markdown según la detección (`03-api-redmine.md › Riesgos`), sanitizado con DOMPurify. Edición con un textarea con preview y atajos básicos (negrita, lista, código). Preferencia manual del formato en Preferencias.
  - _Depende:_ F3-T01
  - _Acepta:_ un `<script>` en la descripción no se ejecuta; los enlaces `#123` llevan a la tarea dentro de la app.

- [ ] **F3-T04** Historial y comentarios — journals en línea de tiempo (comentarios y cambios de campo resumidos: "Estado: Nueva → En curso"). Caja de comentario fija abajo; `Ctrl/⌘+Enter` publica. Comentarios privados si el permiso existe.
  - _Depende:_ F3-T01
  - _Acepta:_ el comentario aparece al instante (optimista) y se reconcilia con la respuesta.

- [ ] **F3-T05** Relaciones, subtareas y observadores — listas compactas con añadir/quitar (búsqueda de tareas por `#id` o texto).
  - _Depende:_ F3-T01
  - _Acepta:_ crear "bloquea a #N" desde el detalle se refleja en ambas tareas.

- [ ] **F3-T06** Adjuntos — lista con descarga y vista previa de imágenes; subir arrastrando sobre el panel (`/uploads.json` → token → `PUT issue.uploads`), con progreso por archivo.
  - _Depende:_ F3-T01, F1-T02
  - _Acepta:_ subir 3 archivos a la vez muestra 3 progresos; un archivo mayor que el límite de Redmine da un error claro.

- [ ] **F3-T07** Diálogo "Nueva tarea" — atajo `N` y botón de toolbar. Título "Nueva tarea en *Proyecto*". Campos visibles: proyecto (si hay varios, recuerda el último), tracker, asunto, descripción, asignado, prioridad; "Más campos" despliega el resto incluidos los personalizados obligatorios del tracker. Validación dinámica con Zod. Borrador persistido: cerrar sin guardar pregunta *Seguir editando* / *Descartar* (`modality.md`). "Crear y otra" mantiene proyecto y tracker.
  - _Depende:_ F3-T02, F1-T07
  - _Acepta:_ crear una tarea con el teclado solo (N, escribir, Tab, Ctrl+Enter); el toast dice "Tarea #N creada" con enlace; solo aparecen proyectos donde hay `add_issues`.

- [ ] **F3-T08** Copiar y mover — "Duplicar" (abre el diálogo prellenado) y "Mover a proyecto" según permisos.
  - _Depende:_ F3-T07
  - _Acepta:_ mover a un proyecto sin el tracker actual pide elegir uno nuevo antes de guardar.

## Definición de hecho

Una tarea se puede ver, editar, comentar y adjuntar sin salir de la lista. Crear una tarea se hace solo con el teclado. E2e: crear → editar estado → comentar.
