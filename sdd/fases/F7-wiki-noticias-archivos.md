# F7 · Wiki, noticias y archivos

**Objetivo:** consultar y mantener la documentación del proyecto sin abrir Redmine.

**Depende de:** F1 (reutiliza el render de texto de F3-T03 si ya existe)

## Tareas

- [~] **F7-T01** Índice de wiki — `/projects/:id/wiki`: árbol de páginas (`index.json`, jerarquía por `parent`), búsqueda por título, página de inicio destacada.
  - _Depende:_ F1-T06
  - _Acepta:_ solo visible con módulo `wiki` y `view_wiki_pages`.
  - _Hecho:_ dd6b628. `/wiki` lista los proyectos con wiki legible (entra directo si hay uno); `/projects/:id/wiki` con inicio destacado, árbol (`shared/redmine/wiki.ts`, con tests), búsqueda, "Nueva página" con `edit_wiki_pages` y cambios recientes. Pendiente de verificar en el navegador.

- [~] **F7-T02** Página de wiki — render sanitizado con enlaces internos (`[[Página]]` y `#123`) resueltos dentro de la app; tabla de contenidos lateral para páginas largas; adjuntos de la página; "Ver en Redmine".
  - _Depende:_ F7-T01, F3-T03
  - _Acepta:_ un enlace a una página inexistente lleva a "Esta página aún no existe" con "Crearla" si hay `edit_wiki_pages`.
  - _Hecho:_ dd6b628. `resolveWikiLinks` convierte `[[Página]]`, `[[Página|texto]]`, `#ancla` y `[[proyecto:Página]]` antes del render de F3-T03; las rutas internas navegan sin recargar. Índice lateral con 3 títulos o más. Adjuntos por el proxy (`shared/redmine/paths.ts`, que también escapa `! ' ( ) *` para que pasen el filtro del proxy). Pendiente de verificar.

- [~] **F7-T03** Edición de wiki — editor con preview lado a lado (apilado en compacto), comentario de cambio, envío con `version` para detectar conflictos: ante un 409, mostrar las diferencias y ofrecer *Copiar mi texto* y *Recargar* (nunca sobrescribir en silencio).
  - _Depende:_ F7-T02
  - _Acepta:_ editar la misma página en dos pestañas produce el aviso de conflicto en la segunda.
  - _Hecho:_ dd6b628. Editor y vista previa lado a lado, comentario del cambio, Mod+Enter guarda. Se envía `version`; comprobado por API que Redmine responde 409 con una versión desfasada. Ante el 409: diferencias por líneas (`lineDiff`), "Copiar mi texto" y "Recargar"; guardar queda bloqueado hasta resolverlo. Pendiente de probar con dos pestañas.

- [~] **F7-T04** Noticias — lista por proyecto y global (`/news.json`), detalle con comentarios; crear noticia con `manage_news`.
  - _Depende:_ F1-T06
  - _Acepta:_ la sidebar muestra un punto "Novedades" con texto accesible si hay noticias desde la última visita.
  - _Hecho:_ 4d41d46. `/news` (todas o `?project=`), `/news/:id` con texto, adjuntos y comentarios, y "Publicar noticia" con `manage_news` (Redmine ≥ 5.1; comprobado contra el 6.1 local: responde 204). La API no deja comentar: "Comentar en Redmine". "Noticias" en la sidebar con punto neutro (no Ruby) y texto accesible "Novedades: N"; la primera visita no avisa (`shared/redmine/news.ts`, con tests; `redmine-client:news-seen`). Pendiente de verificar en el navegador.

- [~] **F7-T05** Archivos del proyecto — lista agrupada por versión con tamaño, autor y fecha; descarga; subir con arrastrar y soltar (`/uploads.json` → `/projects/:id/files.json`) con progreso, solo con `manage_files`.
  - _Depende:_ F1-T06, F1-T02
  - _Acepta:_ cancelar una subida en curso la detiene y no deja un archivo a medias en el proyecto.
  - _Hecho:_ 6f9e91f. `/projects/:id/files`, agrupados por versión (`shared/redmine/files.ts`, con tests), descarga por el proxy. `RedmineRequest` gana `signal` y `onUploadProgress` (opcionales); `ProxyTransport` usa XHR solo cuando hace falta progreso. Cliente: `upload` (token), `addProjectFile`, `listProjectFiles`. Cancelar aborta antes de `POST files.json`, así que el proyecto no recibe nada. Flujo comprobado por API contra el Redmine 6.1 local. Pendiente de verificar en el navegador (TauriTransport, F8-T04, deberá implementar los dos campos nuevos).

## Definición de hecho

Wiki legible y editable con detección de conflictos, noticias visibles y archivos descargables y subibles, todo restringido por módulo y permiso.
