# F6 · Proyectos y versiones

**Objetivo:** entender en qué está cada proyecto (versiones, avance, quién participa) y saltar a sus tareas filtradas.

**Depende de:** F1

## Tareas

- [ ] **F6-T01** Navegador de proyectos — vista "Proyectos": árbol de proyectos y subproyectos (máx. dos niveles visibles, el resto con "Ver subproyectos"), búsqueda por nombre, fijar proyectos (aparecen en la sidebar, persistido). Cada fila muestra tareas abiertas y la próxima versión.
  - _Depende:_ F1-T06
  - _Acepta:_ fijar/desfijar con teclado; un proyecto archivado no aparece.

- [ ] **F6-T02** Página de proyecto — `/proyectos/:id`: cabecera con nombre, descripción (render sanitizado), módulos habilitados como accesos (Tareas, Tiempo, Wiki, Noticias, Archivos, solo los habilitados y permitidos). Resumen: tareas por tracker (abiertas / cerradas), horas del mes si hay `view_time_entries`.
  - _Depende:_ F6-T01
  - _Acepta:_ cada número es un enlace a la lista con la frase de filtros correspondiente.

- [ ] **F6-T03** Roadmap de versiones — `/proyectos/:id/versiones`: versiones abiertas por fecha, con barra de avance (cerradas / total y % por `done_ratio`, con texto "18 de 25 · 72 %"), fecha y días restantes, estimado vs. registrado. Versiones cerradas plegadas.
  - _Depende:_ F6-T02
  - _Acepta:_ el avance coincide con el roadmap de Redmine para la misma versión.

- [ ] **F6-T04** Detalle de versión — tareas de la versión agrupadas por estado, con la misma tabla de F2; acciones de `manage_versions` (editar fecha, estado, descripción) si el permiso existe.
  - _Depende:_ F6-T03, F2-T03
  - _Acepta:_ sin `manage_versions` no se ve ninguna acción de edición.

- [ ] **F6-T05** Miembros — lista de miembros del proyecto con roles; clic lleva a "tareas asignadas a *persona* en este proyecto".
  - _Depende:_ F6-T02
  - _Acepta:_ los grupos se muestran como grupo con su número de miembros.

## Definición de hecho

Desde la sidebar se llega a cualquier proyecto fijado y a su próxima versión en ≤ 2 clics; todos los números son enlaces a filtros reproducibles.
