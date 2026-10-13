# F9 · Pulido, accesibilidad y rendimiento

**Objetivo:** pasar de "funciona" a "está terminado". Auditoría completa contra la HIG y el sistema de diseño, y arreglos priorizados.

**Depende de:** F2–F7

## Tareas

- [ ] **F9-T01** Auditoría de diseño — revisar cada pantalla con la skill `apple-design` (las 5 lentes: accesibilidad, convenciones, craft, interacción, escritura), con capturas en claro, oscuro, 375 px y 1280 px. Resultado en `docs/design/auditoria-F9.md` con hallazgos etiquetados Critical / High / Medium / Low.
  - _Acepta:_ el documento existe, y cada hallazgo Critical y High tiene su tarea `F9-Txx` creada abajo.

- [ ] **F9-T02** Accesibilidad automática — `@axe-core/playwright` en los e2e de las pantallas principales; CI falla con violaciones serias o críticas.
  - _Acepta:_ 0 violaciones serias en lista, detalle, popover de tiempo, timesheet, importación y conexión.

- [ ] **F9-T03** Lector de pantalla — recorrido manual con NVDA (Windows) y VoiceOver (macOS) de: conectar, filtrar, registrar tiempo, crear tarea, importar. Arreglar etiquetas, orden y anuncios.
  - _Acepta:_ cada flujo se completa sin mirar la pantalla; notas en `docs/design/lectores.md`.

- [ ] **F9-T04** Preferencias del sistema — reduced motion, reduced transparency (si se usa algún blur), alto contraste y zoom al 200 % verificados en todas las pantallas.
  - _Acepta:_ capturas de cada modo en `docs/design/`.

- [ ] **F9-T05** Rendimiento — presupuesto: JS inicial < 250 KB gzip, primera lista visible < 1.5 s con caché caliente, scroll de 2 000 filas a 60 fps. Code splitting de exceljs (solo se carga al importar o descargar plantilla) y del editor de wiki.
  - _Acepta:_ reporte de `nuxi analyze` y Lighthouse en `docs/`; exceljs fuera del bundle inicial.

- [ ] **F9-T06** Errores y offline — revisar todos los estados de error contra `01-arquitectura.md › Errores`; la caché se ve sin conexión con un banner; las mutaciones fallidas por red se pueden reintentar.
  - _Acepta:_ cortar la red en DevTools durante el uso no deja pantallas en blanco.

- [ ] **F9-T07** Ayuda y tips — tips contextuales la primera vez que aparece la frase de filtros, el popover de tiempo y la importación (una vez cada uno, con opción "No volver a mostrar"); hoja de atajos con `?`.
  - _Acepta:_ los tips no aparecen al arrancar ni bloquean la interacción (`onboarding.md`).

## Definición de hecho

Ningún hallazgo Critical ni High abierto en la auditoría; axe en verde en CI; presupuestos de rendimiento cumplidos.
