# 02 · Sistema de diseño

Base: Human Interface Guidelines de Apple (skill `apple-design`, archivos en `references/hig/`) aplicadas a una app web/Tauri, con un criterio propio de estudio para que no parezca una plantilla.

## Tesis

**Redmine sin fricción: lo frecuente se hace sin salir de la lista.**

La lista de tareas es la pantalla principal. Filtrar, cambiar estado, registrar tiempo y crear una tarea pasan ahí, en popovers y diálogos cortos.

> **Rediseño F2b (2026-10-15).** La pantalla de inicio pasa a ser el Workspace (F2c) y el mundo visual se rehace. Lo que sigue en este documento se actualiza tarea a tarea en F2b; donde choque, manda esta sección.

## Mundo visual: Panel de embarque

Elegido por el equipo en la ronda de dirección de impeccable (contrato completo en `.impeccable/surfaces/app-pages-index-vue.md`).

- **Idea:** mis tareas son un panel de salidas. La fecha fin ordena todo y un cambio se recoloca en su sitio y queda marcado hasta que lo veo.
- **Superficies:** paneles neutros de alto contraste sobre un fondo apenas cálido; sin líneas por fila, con rellenos alternos muy suaves.
- **Columnas fijas** con cabeceras en versalitas de 11 px: `#` · Tarea · Vence ↓ · Prioridad · Estado · acciones.
- **Códigos de proyecto** en placa oscura mono (PCL, APP): identifican el proyecto sin color.
- **Franja de salidas:** barra oscura bajo el toolbar con la fecha, la tarea en curso con su cronómetro, pendientes, vencen hoy y registrado hoy.
- **Color de aviso** (amarillo de panel): solo para "cambiado", como relleno suave de la fila y etiqueta "Subida · ahora"; nunca borde de color.
- **Ruby:** acción primaria, RTQA y foco. Nada más.
- **Movimiento propio:** la fila que cambia se recoloca en vivo conservando su identidad (animación de layout) y queda marcada. Respeta `prefers-reduced-motion`.
- **Iconos:** Lucide para todo, incluida la prioridad (nada de glifos Unicode como iconos).

## Elemento distintivo: la frase de filtros

La barra de filtros se lee como una oración en español:

```
Tareas  [asignadas a mí ▾]  en  [Abierta, En curso ▾]  de  [Portal Web ▾]  [+ condición]
```

- Cada fragmento entre corchetes es un **token**: un botón que abre un popover con las opciones (lista con búsqueda, multi-selección con checkbox, rango de fechas con atajos "hoy", "esta semana", "este mes").
- Las conjunciones ("en", "de", "con", "que vencen") son texto secundario, no interactivo. Leen la consulta en voz alta.
- `+ condición` abre la lista de campos disponibles **para los proyectos en vista** (incluidos los campos personalizados filtrables).
- Un token se quita con su botón ✕ o con Retroceso cuando tiene foco.
- La frase se refleja en la URL; atrás/adelante del navegador recorre los cambios.
- Por qué es el elemento distintivo: responde al pedido "filtros dinámicos y fáciles", traduce el lenguaje de base de datos de Redmine (`assigned_to_id = me`) a lo que la persona diría, y no existe en el Redmine original. Es el único lugar donde la UI se permite personalidad; el resto es deliberadamente quieto.

## Color

Todos los colores salen de `app/assets/css/tokens.css`. Contrastes medidos (WCAG 2.x) al crear el repo:

Paleta F2b (Panel de embarque). Contraste claro, medido por `pnpm check:contrast`, que comprueba 21 pares en los 4 modos:

| Token | Claro | Oscuro | Uso | Contraste (claro) |
|---|---|---|---|---|
| `surface` | `#F5F5F2` | `#0F1012` | Fondo de la ventana | — |
| `raised` | `#FFFFFF` | `#1A1B1E` | Paneles, popovers, diálogos | — |
| `sidebar` | `#ECECEA` | `#151619` | Barra lateral | — |
| `fill-alt` / `fill-hover` / `fill-selected` | `#FAFAF8` / `#F1F1ED` / `#E5E5E0` | `#1E1F22` / `#232428` / `#2D2E33` | Fila alterna, hover, selección (neutra) | — |
| `content` | `#111214` | `#F2F2EF` | Texto principal | 17.16:1 sobre surface |
| `content-secondary` | `#5F6064` | `#A1A1A6` | Metadatos, cabeceras, conjunciones | 5.31:1 sobre sidebar (el peor) |
| `content-tertiary` | `#8A8A8F` | `#7C7C82` | Solo iconos de control (▲▼) | 3.29:1 sobre fill-alt (mínimo 3:1) |
| `accent` (Ruby) | `#B4233A` | `#FF7088` | Acción primaria, RTQA, foco | 5.93:1 sobre surface |
| `on-accent` | `#FFFFFF` | `#1A0A0E` | Texto sobre Ruby | 6.48:1 |
| `board` / `on-board` / `on-board-secondary` | `#111214` / `#FFFFFF` / `#A8A8AD` | `#26272B` / `#F2F2EF` / `#A8A8AD` | Franja de salidas y placas de proyecto | 18.74:1 / 7.92:1 |
| `change-fill` / `on-change` | `#FFF3BF` / `#5A4600` | `#3A3000` / `#FFD84D` | Fila cambiada y etiqueta "Subida · ahora" | 8.15:1 |
| `signal-success` | `#1F7A4D` | `#4CC38A` | Completada | 5.32:1 |
| `signal-warning` | `#8A5A00` | `#E0A63A` | Vence pronto, en curso | 5.93:1 |
| `signal-info` | `#2557C4` | `#7AA2FF` | Enlaces, novedades | 6.48:1 |

Además: `scrim` (velo único de todos los overlays) y tres sombras, `shadow-panel`, `shadow-popover` y `shadow-dialog`, siempre con desplazamiento y desenfoque. Radios: `plate` 4 px, `control` 8 px, `surface` 12 px; sin píldoras.

Reglas:
- **Un color, un significado.** Ruby solo marca la acción primaria y el foco. Nunca se usa para estados ni para decorar.
- **Por qué Ruby:** Redmine está escrito en Ruby on Rails y su identidad histórica es roja. El acento es un guiño al origen sin copiar el logo, y en la paleta neutra destaca sin estridencia.
- Los estados de Redmine (Nueva, En curso, Resuelta...) se muestran con **icono + texto**; el color es apoyo, nunca el único portador (`accessibility.md`).
- Se sigue la apariencia del sistema (`prefers-color-scheme`). No hay selector de tema en la app.
- **Alto contraste, por tema.** `prefers-contrast: more` se declara combinado con `prefers-color-scheme`, porque un bloque suelto vendría después del de oscuro y le ganaría, dejando texto gris oscuro sobre fondo casi negro. En claro el texto secundario baja a `#3D3E42` y en oscuro sube a `#C8C8CC`; los separadores se refuerzan a `#76777C` y `#6B6C72`, y la selección se oscurece un paso.
- `pnpm check:contrast` comprueba los 21 pares (texto a 4.5:1, iconos de control a 3:1) en los 4 modos (claro, claro+alto contraste, oscuro, oscuro+alto contraste) y corre en CI. Cambiar un color sin actualizar esta tabla hace fallar el build.

## Tipografía

| Rol | Familia | Por qué |
|---|---|---|
| UI | Pila del sistema: `-apple-system, "Segoe UI Variable", system-ui` | Controles y navegación con la fuente de la plataforma: se siente nativa en macOS y Windows |
| Datos | `JetBrains Mono` (fallback `ui-monospace`), cifras tabulares | `#ID`, horas, fechas y porcentajes se alinean en columnas y se leen de un vistazo |

Escala (desktop / móvil):

| Estilo | Desktop | Móvil | Uso |
|---|---|---|---|
| large-title | 26 / semibold | 30 / bold | Título de vista |
| title | 17 / semibold | 20 / semibold | Título de diálogo, asunto de tarea en detalle |
| body | 13 / regular | 17 / regular | Texto general, filas |
| caption | 11 / regular | 13 / regular | Metadatos (mínimo: 10 desktop, 11 móvil) |

Sin pesos light/thin en tamaños pequeños. Las tallas usan `rem`/tokens para escalar con el zoom del navegador.

## Layout

Desktop (≥ 900 px): sidebar + lista + detalle.

```
┌──────────┬────────────────────────────────────────────────┬───────────────────────┐
│ Sidebar  │ Toolbar: [Buscar Ctrl+K]           [+ Nueva tarea] │                       │
│          ├────────────────────────────────────────────────┤  Detalle (#4821)      │
│ Mis      │ Tareas [asignadas a mí] en [Abierta] de [Web]  │  Asunto               │
│ tareas   ├────────────────────────────────────────────────┤  Estado ▾  Asignado ▾ │
│ Tiempo   │ #4821  Arreglar login SSO    En curso   2,5 h ⏱│  Descripción          │
│ Proyectos│ #4815  Exportar a CSV        Nueva      0 h  ⏱│  Comentarios          │
│ Wiki     │ #4790  Error en el checkout  Resuelta   6 h  ⏱│  [Registrar tiempo]   │
│ ──────── │                                                │                       │
│ Proyectos│                                                │                       │
│ fijados  │                                                │                       │
└──────────┴────────────────────────────────────────────────┴───────────────────────┘
```

Compacto (< 900 px, y móvil en F10): la sidebar pasa a tab bar inferior (Tareas, Tiempo, Proyectos, Más). El detalle se abre como vista apilada, y la frase de filtros se desplaza en horizontal y se colapsa en "3 filtros ▾".

```
┌──────────────────────────┐
│ Tareas       [🔍] [+]    │
│ [asignadas a mí] [Abier… │
├──────────────────────────┤
│ #4821 Arreglar login SSO │
│ En curso · 2,5 h       ⏱ │
├──────────────────────────┤
│ #4815 Exportar a CSV     │
│ Nueva · 0 h            ⏱ │
├──────────────────────────┤
│ Tareas  Tiempo  Proy  Más│
└──────────────────────────┘
```

- La sidebar tiene como máximo dos niveles y se puede ocultar (`sidebars.md`).
- Las funciones son las mismas en todos los tamaños; solo cambia la disposición (`layout.md`).

## Componentes y patrones

| Necesidad | Componente (Reka UI) | Guía HIG |
|---|---|---|
| Registrar tiempo | `Popover` anclado al ⏱ de la fila o al botón del detalle | `popovers.md › Best practices`: "Use a popover to expose a small amount of information or functionality." |
| Tokens de filtro | `Popover` + `Listbox`/`Combobox` | Mismo principio; uno abierto a la vez: "Show one popover at a time." |
| Crear tarea | `Dialog` | `modality.md › Best practices`: "Aim to keep modal tasks simple, short, and streamlined." |
| Confirmar borrado | `AlertDialog` | Solo para acciones destructivas e irreversibles |
| Feedback de guardado | `Toast` con "Deshacer" | Feedback en la interfaz, no en alertas |
| Búsqueda global | Command palette (`Dialog` + `Combobox`) con `Ctrl/⌘+K` | `searching.md › Best practices`: "Aim to make your app's content searchable through a single location." |
| Lista de tareas | Tabla virtualizada con cabeceras descriptivas | `lists-and-tables.md › Content`: "Use descriptive column headings in a multicolumn table." |
| Primer uso | Una sola pantalla de conexión + tips contextuales | `onboarding.md › Best practices`: "Consider providing a collection of context-specific tips instead of a single onboarding flow." |

Reglas de popovers y diálogos:
- **El popover guarda el borrador si se cierra solo.** `popovers.md`: "Always save work when automatically closing a nonmodal popover." El tiempo a medio escribir se conserva por tarea hasta enviarlo o pulsar Cancelar.
- **Nunca dos modales.** `modality.md`: "Let people dismiss a modal view before presenting another one."
- **El diálogo nombra su tarea** ("Nueva tarea en Portal Web") y tiene una salida obvia (Cancelar + Esc).
- **Confirmar antes de perder datos:** si el diálogo de nueva tarea tiene cambios, cerrarlo pregunta "¿Descartar la tarea sin guardar?" con *Seguir editando* (por defecto) y *Descartar*.

### El popover de tiempo, en detalle

```
┌ Registrar tiempo · #4821 ───────────┐
│ [ 1h30          ]  = 1,5 h          │
│ Actividad  (Desarrollo) (Revisión)  │
│            (Reunión)    Otra ▾      │
│ Fecha      Hoy ▾                    │
│ Comentario [                     ]  │
│                [Cancelar] [Registrar]│
└─────────────────────────────────────┘
```

- El foco entra en la duración. Se aceptan `1h30`, `1:30`, `1.5`, `1,5` y `90m`, con la conversión visible al lado.
- Los chips de actividad son las 3 más usadas por el usuario en ese proyecto; la última usada viene preseleccionada.
- Enter registra. Tras guardar: el popover se cierra, la cifra de horas de la fila se actualiza (el momento de movimiento) y aparece el toast "Tiempo registrado · Deshacer".
- Atajo: `T` sobre la fila enfocada o en el detalle.

## Movimiento

Una sola animación con intención, el resto mínimo (`motion.md › Providing feedback`: "In apps, generally avoid adding motion to UI interactions that occur frequently.").

- **El momento:** al registrar tiempo, la cifra de horas de la fila sube (roll numérico, resorte `visualDuration: 0.35, bounce: 0.15`) y el icono ⏱ hace un pulso breve. Comunica "se sumó a esta tarea" sin un mensaje modal.
- **Transiciones funcionales:** popovers y diálogos con fade + escala 0.98→1 en 120–160 ms; la salida es más rápida que la entrada. Filas nuevas o eliminadas con `AnimatePresence` (opacidad/altura, 150 ms).
- **No se anima:** hover de filas, cambios de filtro, scroll, navegación de la sidebar.
- **Siempre cancelable:** nada bloquea la interacción mientras anima (`motion.md`: "Let people cancel motion.").
- **`prefers-reduced-motion`:** el roll numérico pasa a un cambio directo, y las transiciones a fade de 0 ms. Se usa `useReducedMotion()` de motion-v y la regla global de `main.css`.

## Iconos

- **Lucide**, trazo 1.75, tamaño 16 px en filas y 18 px en toolbar, alineado con el peso del texto.
- Un solo lenguaje visual: no mezclar con otros sets. Si falta un icono, se dibuja en SVG con la misma rejilla y trazo.
- Todo botón con solo icono lleva `aria-label` y tooltip con el atajo ("Registrar tiempo (T)").
- Mapa base: tarea `lucide:ticket`, tiempo `lucide:timer`, proyecto `lucide:folder-kanban`, versión `lucide:milestone`, wiki `lucide:book-open`, noticias `lucide:newspaper`, archivos `lucide:paperclip`, importar `lucide:file-spreadsheet`, filtro `lucide:list-filter`.

## Escritura

- Español, voz activa, sentence case ("Nueva tarea", "Registrar tiempo").
- El verbo del botón se repite en el resultado: "Registrar tiempo" → "Tiempo registrado"; "Importar 24 tareas" → "24 tareas importadas".
- Vocabulario de Redmine en español: tarea, tracker, estado, versión, actividad.
- Errores sin disculpas, diciendo qué pasó y qué hacer: "La fila 7 no tiene asunto. Escríbelo en la columna B."
- Estados vacíos que invitan a actuar: "No hay tareas con estos filtros. Quita *asignadas a mí* para ver las de todo el equipo."

## Accesibilidad (piso de calidad)

- Objetivos interactivos: 28×28 px mínimo en desktop y 44×44 en táctil (`--control-min`).
- Foco visible en todo (`outline` Ruby de 2 px); orden de tabulación lógico; toda la app se puede usar solo con teclado.
- Atajos: `Ctrl/⌘+K` buscar, `N` nueva tarea, `T` registrar tiempo, `J/K` moverse por la lista, `Enter` abrir, `Esc` cerrar, `/` enfocar filtros. En desktop, todos accesibles también desde el menú nativo (F8).
- Lectores de pantalla: la frase de filtros se anuncia como un grupo ("Filtros: asignadas a mí, en Abierta, de Portal Web"). Los cambios de lista se anuncian con `aria-live="polite"` ("24 tareas").
- Zoom al 200 % sin pérdida de funciones.

## Checklist por pantalla

Antes de marcar `[x]` una tarea de UI:

- [ ] Funciona solo con teclado y el foco es visible.
- [ ] Claro, oscuro y alto contraste revisados.
- [ ] Reduced motion revisado.
- [ ] Ancho compacto (375 px) y regular (1280 px) revisados.
- [ ] Botones con solo icono tienen `aria-label`.
- [ ] Estados vacío, cargando y error diseñados (no pantallas en blanco).
- [ ] Textos según *Escritura*.
- [ ] Acciones protegidas por permiso.
- [ ] Revisión rápida con la skill `apple-design` (las 5 lentes) para pantallas nuevas.
