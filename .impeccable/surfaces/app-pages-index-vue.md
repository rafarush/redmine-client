---
version: 1
slug: "app-pages-index-vue"
primary_target: "app/pages/index.vue"
related_targets: ["app/layouts/default.vue"]
---

# Surface brief: Workspace (y shell de toda la app)

Modo: Operate. Equipo interno que abre la app varias veces al día con teclado y ratón; luz de oficina, también por la tarde (claro por defecto, oscuro con el sistema).
Tarea: ver mis tareas asignadas por proyecto, ordenadas por fecha fin y prioridad, y llevarlas de pendiente a RTQA con el tiempo registrado sin salir de la pantalla.
Restricciones: HIG; Ruby solo en acción primaria y foco; tipografía del sistema + mono tabular para datos; estado con icono + texto; 4 modos de contraste.

## Direction contract

THESIS: Mis tareas son un panel de salidas: la fecha fin ordena todo y un cambio se recoloca en su sitio y queda marcado hasta que lo veo. Rechaza la lista de cards iguales y la tabla con línea en cada fila.

OWN-WORLD: Paneles neutros de alto contraste sobre un fondo apenas cálido (claro #f5f5f2 / blanco; oscuro carbón). Tinta casi negra, secundario gris neutro. Columnas fijas con cabeceras en versalitas de 11 px. Códigos de proyecto en placa negra mono (PCL, APP). Sin líneas por fila: rellenos alternos muy suaves. Un único color de aviso (amarillo de panel) reservado para "cambiado", como relleno suave, nunca borde. Ruby: primaria, RTQA y foco.

STORY: Entro y sé qué me toca hoy (franja de salidas), qué tengo en curso (cronómetro vivo) y qué vence. Subo o bajo prioridades, arranco, completo y paso a QA desde la fila.

FIRST VIEWPORT: Sidebar 220 px (Workspace, Tareas, Tiempo, Proyectos; grupo Boards con placas de código). Toolbar: título grande "Workspace", candado, búsqueda ⌘K, "Añadir board" Ruby. Franja de salidas oscura de 48 px: fecha, tarea en curso + cronómetro, pendientes, vencen hoy, registrado hoy. Debajo, rejilla de paneles (2 columnas ≥1280, 1 en compacto) con columnas # · Tarea · Vence ↓ · Prioridad · Estado · acciones (▲▼).

FORM: Panel de embarque (challenger del catálogo, vernacular-ephemera-boarding-pass-and-gate-board), elegido por el usuario sobre la dirección asignada. seed:e9a6e6062bfd41dc. Gesto propio: la fila que cambia de prioridad o de estado se recoloca en vivo (animación de layout que conserva la identidad de la fila) y queda marcada "Subida · ahora" hasta el siguiente cambio de vista. Movimiento: solo ese recolocado y las entradas/salidas de popovers; respeta reduce-motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
