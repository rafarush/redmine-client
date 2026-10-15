# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Equipo interno de la empresa (uso interno, una o pocas instancias de Redmine conocidas). Todos ya usan Redmine: no hay que enseñarles qué es un tracker, sino quitarles pasos.
- **Desarrolladores y soporte**: abren la app varias veces al día, filtran lo suyo, actualizan estados y registran horas.
- **Líderes y PM**: crean tareas en lote, revisan versiones y avance, miran las horas del equipo.

## Product Purpose
Cliente de Redmine (web y desktop; móvil después) con una UX más simple que la de Redmine. Usa la REST API con la API key del usuario y muestra solo lo que ese usuario puede hacer. Éxito: registrar tiempo en ≤ 5 s y ≤ 3 interacciones, cambiar un filtro sin recarga, crear 50 tareas desde Excel en < 2 min y 0 acciones no permitidas visibles.

## Positioning
Redmine sin fricción: lo frecuente se hace sin salir de la lista. Lo propio es la frase de filtros (se lee como una oración y vive en la URL) y que la interfaz oculta lo que el usuario no puede hacer. Detalle en `sdd/00-vision.md` y `sdd/02-diseno.md`.

## Operating Context
- Redmine 5.x/6.x es la fuente de verdad; la app no tiene base de datos propia.
- Web: SPA Nuxt con proxy Nitro y sesión sellada. Desktop: Tauri 2 con la API key en el llavero del SO. Móvil después, también con Tauri.
- Uso repetido a lo largo del día, con teclado y ratón en desktop.

## Capabilities and Constraints
- No es una consola de administración de Redmine (usuarios, roles, workflows y campos personalizados se gestionan en Redmine).
- Cada acción se protege con el permiso de Redmine correspondiente: si el usuario no puede, se oculta (se deshabilita con explicación solo si ocultarla confundiría).
- La API key nunca va a `localStorage` ni `sessionStorage`.
- Vocabulario de Redmine: tarea, tracker, versión.
- Plan por fases F0–F10 en `sdd/`.

## Brand Commitments
- Tono visual pedido por el equipo: estilo Apple, minimalista, funcional, muy limpio y conciso. Base: Human Interface Guidelines.
- Voz: español cercano, en voz activa; el verbo dice lo que pasa ("Registrar tiempo") y el toast repite el verbo. Algo de calidez en vacíos y avisos sin perder claridad.
- Acento Ruby solo en la acción primaria y en el foco; el estado se comunica con icono + texto, nunca solo con color.
- Pendiente: nombre definitivo del producto y logo (no hay assets de marca).

## Evidence on Hand
- Redmine local de pruebas en Docker (`docker/`, `pnpm seed`) con datos de prueba.
- No hay testimonios, métricas de uso reales ni capturas de usuarios; no inventarlos.

## Product Principles
- Un solo trabajo por pantalla; la lista de tareas es el centro y lo frecuente pasa ahí.
- Deshacer en vez de confirmar; los borradores no se pierden.
- Se oculta lo que no se puede hacer; los campos poco usados quedan en "Más campos".
- Vocabulario y patrones familiares de Redmine y de la plataforma.
- El teclado es ciudadano de primera: lo que se hace con ratón se puede hacer sin él.

## Accessibility & Inclusion
Piso actual, sin comprometer un estándar formal: contraste verificado en los 4 modos (claro, oscuro y sus alto contraste), todo operable con teclado, foco visible, `prefers-reduced-motion` respetado, botones de solo icono con `aria-label`, objetivos de 44 pt con puntero táctil.
