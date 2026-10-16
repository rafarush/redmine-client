# F3 · Detalle, edición y creación de tareas

**Objetivo:** ver y editar una tarea sin perder la lista de vista, y crear tareas en un diálogo corto.

**Depende de:** F2

## Tareas

- [~] **F3-T01** Panel de detalle — split view a la derecha de la lista en desktop (ancho redimensionable y recordado), vista apilada en compacto. Ruta `/tareas/:id` (enlace directo). Cabecera: `#id` (`.data`), asunto, proyecto › tracker, botón "Abrir en Redmine".
  - _Depende:_ F2-T03
  - _Acepta:_ abrir otra tarea desde la lista reemplaza el panel sin recargar; `Esc` cierra el panel y devuelve el foco a la fila.
  - _Nota (2026-10-15):_ adelantada una primera versión como página `/issues/:id` (código en inglés, ver CLAUDE.md), para el clic del workspace (F2c-T10): cabecera, cronómetro y flujo, descripción en texto plano, comentarios y datos. Falta el split view junto a la lista, `Esc` y recordar el ancho.

- [~] **F3-T02** Edición inline de campos — estado (con `allowed_statuses`), asignado, prioridad, versión, categoría, fechas, estimación, % hecho y campos personalizados según tipo (lista, fecha, número, booleano, usuario, texto). Cada campo se guarda solo, con indicador "Guardado" y Deshacer. Campos sin permiso de edición se muestran como texto.
  - _Depende:_ F3-T01, F1-T07
  - _Acepta:_ errores 422 aparecen junto al campo; un usuario con `edit_own_issues` solo edita las suyas.
  - _Hecho:_ 529586b. `issues/IssueFields.vue` sustituye al panel de datos de `/issues/:id`: estado (`allowed_statuses`), asignada (miembros), prioridad, sprint (versiones abiertas), categoría, fechas (coherentes entre sí), estimado (número suelto = horas, también > 24) y % hecho, más los campos personalizados de un valor como texto (sin admin no se conoce su tipo). Enter o elegir guarda, Esc cancela, "Guardado" junto al campo y "Deshacer" en el aviso; un 422 sale bajo el campo. `canEditIssue` y `toFieldPayload` en `shared/redmine/issue-fields.ts`, con tests. Pendiente de verificar.

- [~] **F3-T03** Descripción y formato de texto — render de textile o markdown según la detección (`03-api-redmine.md › Riesgos`), sanitizado con DOMPurify. Edición con un textarea con preview y atajos básicos (negrita, lista, código). Preferencia manual del formato en Preferencias.
  - _Depende:_ F3-T01
  - _Acepta:_ un `<script>` en la descripción no se ejecuta; los enlaces `#123` llevan a la tarea dentro de la app.
  - _Hecho:_ 7fc0cb9. `shared/redmine/rich-text.ts`: detección por señales (ante la duda, textile), `markdown-it` (`html: false`) y `textile-js`, saneado con DOMPurify y `#N` → `/issues/N` fuera de `<a>/<code>/<pre>`; si DOMPurify no está soportado se escapa el texto. Tests en jsdom (happy-dom serializa mal `<template>`). `text/RichText.vue` y `text/RichTextEditor.vue` (Escribir / Vista previa, negrita Mod+B, lista, código, Mod+Enter guarda, Esc cancela). Se usa en la descripción (editable con `edit_issues` o `edit_own_issues` si es tuya, con Deshacer), en los comentarios del historial y en la descripción del proyecto. Preferencia "Formato del texto" en el menú de cuenta (`redmine-client:text-format`). Pendiente de verificar en el navegador.

- [~] **F3-T04** Historial y comentarios — journals en línea de tiempo (comentarios y cambios de campo resumidos: "Estado: Nueva → En curso"). Caja de comentario fija abajo; `Ctrl/⌘+Enter` publica. Comentarios privados si el permiso existe.
  - _Depende:_ F3-T01
  - _Acepta:_ el comentario aparece al instante (optimista) y se reconcilia con la respuesta.
  - _Hecho:_ 2170315. `shared/redmine/journals.ts` (frases de cambio con nombres de catálogo, campos personalizados, adjuntos y relaciones) con tests; `issues/IssueHistory.vue` sustituye al panel de comentarios de `/issues/:id`. Notas privadas con `set_notes_private` (añadido al mapa de permisos). Si falla, el texto vuelve a la caja. Pendiente de verificar contra el Redmine local.

- [~] **F3-T05** Relaciones, subtareas y observadores — listas compactas con añadir/quitar (búsqueda de tareas por `#id` o texto).
  - _Depende:_ F3-T01
  - _Acepta:_ crear "bloquea a #N" desde el detalle se refleja en ambas tareas.
  - _Hecho:_ 4d92a81. `issues/IssueLinks.vue` en `/issues/:id` (el detalle pide `relations,children,watchers`). Relaciones nombradas desde la tarea abierta (`shared/redmine/relations.ts`, con tests: "Bloquea a" / "Bloqueada por", retraso en días); al crear o quitar se revalidan las dos tareas. Subtareas en árbol; "hacer subtarea" una existente con `parent_issue_id`. Observadores desde los miembros del proyecto. `issues/IssuePicker.vue` busca por `#N` o asunto (combobox con flechas). Permisos `manage_issue_relations`, `manage_subtasks`, `add_issue_watchers`/`delete_issue_watchers` (añadidos al mapa). Esquemas en `relations.ts` para no tocar `types.ts`. Pendiente de verificar.

- [~] **F3-T06** Adjuntos — lista con descarga y vista previa de imágenes; subir arrastrando sobre el panel (`/uploads.json` → token → `PUT issue.uploads`), con progreso por archivo.
  - _Depende:_ F3-T01, F1-T02
  - _Acepta:_ subir 3 archivos a la vez muestra 3 progresos; un archivo mayor que el límite de Redmine da un error claro.
  - _Hecho:_ 5c22b93. `issues/IssueAttachments.vue` en `/issues/:id` (el detalle pide ahora `attachments`): miniaturas de imágenes con vista ampliada, descarga por el proxy, subir arrastrando o con el clip. Cola compartida con F7-T05 en `useUploads` + `files/UploadList.vue` (progreso y cancelar por archivo). Adjunta con `PUT issue.uploads`; el error de tamaño es el mensaje de Redmine (422 de `/uploads.json`). Permiso: `edit_issues`, `add_issue_notes` o `edit_own_issues` si es tuya. Pendiente de verificar.

- [ ] **F3-T07** Diálogo "Nueva tarea" — atajo `N` y botón de toolbar. Título "Nueva tarea en *Proyecto*". Campos visibles: proyecto (si hay varios, recuerda el último), tracker, asunto, descripción, asignado, prioridad; "Más campos" despliega el resto incluidos los personalizados obligatorios del tracker. Validación dinámica con Zod. Borrador persistido: cerrar sin guardar pregunta *Seguir editando* / *Descartar* (`modality.md`). "Crear y otra" mantiene proyecto y tracker.
  - _Depende:_ F3-T02, F1-T07
  - _Acepta:_ crear una tarea con el teclado solo (N, escribir, Tab, Ctrl+Enter); el toast dice "Tarea #N creada" con enlace; solo aparecen proyectos donde hay `add_issues`.

- [ ] **F3-T08** Copiar y mover — "Duplicar" (abre el diálogo prellenado) y "Mover a proyecto" según permisos.
  - _Depende:_ F3-T07
  - _Acepta:_ mover a un proyecto sin el tracker actual pide elegir uno nuevo antes de guardar.

## Definición de hecho

Una tarea se puede ver, editar, comentar y adjuntar sin salir de la lista. Crear una tarea se hace solo con el teclado. E2e: crear → editar estado → comentar.
