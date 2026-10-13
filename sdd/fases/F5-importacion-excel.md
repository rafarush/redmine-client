# F5 · Importación desde Excel

**Objetivo:** crear muchas tareas a la vez con una **plantilla fija descargable**, sin sorpresas: todo se valida y se revisa antes de crear nada.

**Depende de:** F3

## Plantilla (v1)

Hoja `Tareas`, una fila por tarea, cabeceras fijas:

| Col | Cabecera | Obligatoria | Valor |
|---|---|---|---|
| A | Fila | — | Número (prellenado 1..N), para referenciar padres |
| B | Asunto | Sí | Texto |
| C | Tracker | Sí | Desplegable (trackers del proyecto) |
| D | Descripción | No | Texto |
| E | Estado | No | Desplegable (estado inicial válido) |
| F | Prioridad | No | Desplegable |
| G | Asignado a | No | Desplegable (miembros asignables) |
| H | Versión | No | Desplegable (versiones abiertas) |
| I | Categoría | No | Desplegable |
| J | Fecha de inicio | No | Fecha |
| K | Fecha de fin | No | Fecha |
| L | Estimación (h) | No | Número o duración (`1h30`) |
| M | Padre (fila) | No | Número de la columna A **o** `#id` de una tarea existente |
| N… | *Campos personalizados* | Según tracker | Una columna por campo del proyecto, con desplegable si es lista |

Hojas ocultas: `_listas` (valores válidos para los desplegables) y `_meta` (id de proyecto, versión de plantilla, fecha de generación).

## Tareas

- [ ] **F5-T01** Generador de plantilla — `shared/import/template.ts` con exceljs: construye el libro desde los catálogos del proyecto (incluye campos personalizados), aplica validación de datos, formatos de fecha, anchos de columna, cabecera fija y una fila de ejemplo en gris que se ignora al importar. Botón "Descargar plantilla" en el proyecto y en el diálogo de importación.
  - _Depende:_ F1-T06
  - _Acepta:_ el archivo abre en Excel y LibreOffice con los desplegables funcionando; test que valida hojas y cabeceras.

- [ ] **F5-T02** Lector y validación — `shared/import/parse.ts`: lee `.xlsx`, comprueba hoja `Tareas`, cabeceras y `_meta` (proyecto y versión). Convierte cada fila a un borrador de tarea y valida contra catálogos y permisos: obligatorios, valores existentes (comparación sin distinguir mayúsculas ni acentos), fechas (fin ≥ inicio), estimación con `parseDuration`, padres existentes y **sin ciclos**. Devuelve `{ filas, errores[{ fila, columna, mensaje }] }`.
  - _Depende:_ F5-T01, F4-T01
  - _Acepta:_ tests con un libro válido, uno con cada tipo de error y uno de otro proyecto (mensaje: "Esta plantilla es del proyecto *X*. Descarga la de *Y* o cambia de proyecto.").

- [ ] **F5-T03** Diálogo de importación, paso 1 — "Importar tareas" (`lucide:file-spreadsheet`), solo con `add_issues`. Zona para soltar o elegir archivo y enlace "Descargar plantilla". Al cargar, pasa al preview.
  - _Depende:_ F5-T02, F1-T07
  - _Acepta:_ un archivo que no es `.xlsx` da un error claro en la zona, sin cerrar el diálogo.

- [ ] **F5-T04** Preview — tabla con todas las filas, celdas con error resaltadas (icono + texto, no solo color) y lista de errores con enlace a la celda. Se puede editar una celda en el preview para corregir sin volver a Excel, y excluir filas. El botón primario dice "Importar N tareas" y se habilita solo sin errores en las filas incluidas.
  - _Depende:_ F5-T03
  - _Acepta:_ corregir el último error habilita el botón; el texto del botón refleja las filas incluidas.

- [ ] **F5-T05** Creación en lote — orden topológico (padres antes que hijos), concurrencia 3, reintento con backoff en 5xx y 429, progreso determinado ("12 de 40"). Se puede **cancelar**: se detiene antes de la siguiente tarea y se informa qué se creó. Las filas con error de Redmine (422) no frenan al resto.
  - _Depende:_ F5-T04, F3-T07
  - _Acepta:_ 50 filas con 2 rechazadas por Redmine terminan con 48 creadas y 2 errores explicados; los hijos de una fila fallida se marcan como "no creada: falló el padre (fila 7)".

- [ ] **F5-T06** Resultado y reporte — resumen "48 tareas importadas · 2 con error", lista con enlaces a cada tarea, y "Descargar reporte" (el mismo Excel con columnas `Resultado` e `ID creado`). Al cerrar, la lista se refresca con un filtro "creadas por mí hoy".
  - _Depende:_ F5-T05
  - _Acepta:_ volver a importar el reporte, solo con las filas fallidas corregidas, no duplica las ya creadas (filas con `ID creado` se ignoran y se informa).

## Definición de hecho

Importar 50 tareas con jerarquía desde la plantilla en < 2 min incluida la revisión; ninguna tarea se crea si el usuario no confirma el preview; e2e con un archivo de ejemplo en `tests/fixtures/`.
