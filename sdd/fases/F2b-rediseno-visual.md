# F2b · Rediseño visual

**Objetivo:** sustituir el aspecto actual (SaaS genérico: tres franjas de cromo, filas con línea, sin título, Ruby fuera de su regla) por un mundo visual nuevo, estilo Apple: minimalista, conciso y funcional. Lo nuevo (workspace, kanban) nace ya con este estilo.

**Depende de:** F2-T08. F2-T09 y F2-T10 se aplazan hasta cerrar esta fase (T09 se revisa ya con el estilo nuevo).

**Origen:** crítica de diseño del 2026-10-15 (25/40, `.impeccable/critique/`).

## Tareas

- [x] **F2b-T01** Dirección visual — ronda de dirección con impeccable (`concept-seed`, modo Operate, code-led), elección del usuario y contrato de dirección en el surface brief. Se respeta lo fijado: HIG, Ruby solo en la acción primaria y el foco, tipografía del sistema + mono tabular para datos.
  - _Acepta:_ dirección elegida por el usuario y anotada; `02-diseno.md` actualizado con el resumen. · ✔ f53458e
  - _Nota:_ elegida "Panel de embarque" (challenger del catálogo) sobre la asignada "Barra de comandas". Bocetos en `.impeccable/mocks/decision/`. Las imágenes de referencia del catálogo no se pudieron descargar (sin conexión a impeccable.style); la guía es el boceto elegido.

- [x] **F2b-T02** Tokens nuevos — superficies con contraste real (ventana, contenido, elevado), `--fill-hover`, `--fill-selected`, `--scrim`, separador sutil, escala de sombras de 2–3 niveles, radios sin píldoras y escala tipográfica que se usa (large-title, title, body, caption). Pares nuevos en `scripts/check-contrast.ts`.
  - _Depende:_ F2b-T01
  - _Acepta:_ `pnpm check:contrast` pasa en los 4 modos; ningún hex fuera de `tokens.css`.  · ✔ 304cca6

- [x] **F2b-T03** Componentes `ui/` — Button, IconButton, Popover, Dialog pequeño, Menu, SegmentedControl, Card, Kbd, Tooltip y Toast (abajo, centrado) con los tokens nuevos.
  - _Depende:_ F2b-T02
  - _Acepta:_ foco visible, `aria-label` en los de solo icono, `prefers-reduced-motion` respetado. · ✔ 78736e8
  - _Nota:_ en vez de envolver cada primitiva de Reka, `app/utils/ui-classes.ts` da la misma piel a popovers, menús y diálogos; animación de entrada/salida en `main.css` (`.ui-pop`, `.ui-dialog`, `.ui-scrim`). Nuevos: `UiDialog`, `UiSegmentedControl`, `UiPlate` (código de proyecto), `UiPanel`. El botón de solo icono sigue siendo `UiButton icon-only`. Los toasts se quedan arriba (decisión de `ebe56a4`) con la piel oscura de la franja de salidas.

- [x] **F2b-T04** Shell — un solo toolbar con título grande, sidebar al estilo macOS con un nivel de selección, avatar neutro, velo único `--scrim` en todos los overlays.
  - _Depende:_ F2b-T03
  - _Acepta:_ Ruby solo en acción primaria y foco; e2e de layout actualizados. · ✔ 0e046bf
  - _Nota:_ "Nueva tarea" pasa a secundaria y abre el formulario de Redmine en otra pestaña hasta F3-T07 (ya no es un botón muerto). Cada página pone su título con `definePageMeta({ title })` y sus acciones en `#toolbar-actions` / `#toolbar-primary`.

- [x] **F2b-T05** Lista y frase de filtros — filas sin línea con selección inset y hover distinto; la frase vuelve a leerse como frase (palabras de unión en secundario, valores como botones en línea). Arreglos de la crítica: botones de fila fuera del orden de Tab (menú con Shift+F10), Enter abre en Redmine hasta F3, deshacer al borrar un filtro guardado, placeholders sin jerga de fases, 0 h como "—", altura de cabecera medida.
  - _Depende:_ F2b-T04
  - _Acepta:_ e2e de `issues.spec.ts` en verde; checklist de diseño. · ✔ 0e046bf, 5ef39fa

- [x] **F2b-T06** Ctrl+K con el estilo nuevo — solo estilo; ARIA corregido (grupos con `role=group`, "Borrar búsquedas recientes" fuera del `listbox`).
  - _Depende:_ F2b-T03 · ✔ 0e046bf

- [ ] **F2b-T07** Cierre — capturas a 1280 y 375, `impeccable detect`, revisión final y `DESIGN.md` generado desde lo construido. Nueva crítica para comparar con 25/40.
  - _Depende:_ F2b-T05, F2b-T06, F2c-T07
  - _Nota:_ se hace después del Workspace (F2c): el contrato de dirección describe esa pantalla, así que la revisión final y `DESIGN.md` salen de ella.

## Definición de hecho

Todas las pantallas existentes usan el mundo nuevo, `DESIGN.md` lo describe, contraste y e2e en verde, y la crítica sube de 25/40.
