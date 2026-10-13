# F7 · Wiki, noticias y archivos

**Objetivo:** consultar y mantener la documentación del proyecto sin abrir Redmine.

**Depende de:** F1 (reutiliza el render de texto de F3-T03 si ya existe)

## Tareas

- [ ] **F7-T01** Índice de wiki — `/proyectos/:id/wiki`: árbol de páginas (`index.json`, jerarquía por `parent`), búsqueda por título, página de inicio destacada.
  - _Depende:_ F1-T06
  - _Acepta:_ solo visible con módulo `wiki` y `view_wiki_pages`.

- [ ] **F7-T02** Página de wiki — render sanitizado con enlaces internos (`[[Página]]` y `#123`) resueltos dentro de la app; tabla de contenidos lateral para páginas largas; adjuntos de la página; "Ver en Redmine".
  - _Depende:_ F7-T01, F3-T03
  - _Acepta:_ un enlace a una página inexistente lleva a "Esta página aún no existe" con "Crearla" si hay `edit_wiki_pages`.

- [ ] **F7-T03** Edición de wiki — editor con preview lado a lado (apilado en compacto), comentario de cambio, envío con `version` para detectar conflictos: ante un 409, mostrar las diferencias y ofrecer *Copiar mi texto* y *Recargar* (nunca sobrescribir en silencio).
  - _Depende:_ F7-T02
  - _Acepta:_ editar la misma página en dos pestañas produce el aviso de conflicto en la segunda.

- [ ] **F7-T04** Noticias — lista por proyecto y global (`/news.json`), detalle con comentarios; crear noticia con `manage_news`.
  - _Depende:_ F1-T06
  - _Acepta:_ la sidebar muestra un punto "Novedades" con texto accesible si hay noticias desde la última visita.

- [ ] **F7-T05** Archivos del proyecto — lista agrupada por versión con tamaño, autor y fecha; descarga; subir con arrastrar y soltar (`/uploads.json` → `/projects/:id/files.json`) con progreso, solo con `manage_files`.
  - _Depende:_ F1-T06, F1-T02
  - _Acepta:_ cancelar una subida en curso la detiene y no deja un archivo a medias en el proyecto.

## Definición de hecho

Wiki legible y editable con detección de conflictos, noticias visibles y archivos descargables y subibles, todo restringido por módulo y permiso.
