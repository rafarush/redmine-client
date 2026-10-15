/**
 * Clases compartidas de las superficies flotantes (sdd/02-diseno.md › Mundo visual).
 *
 * Los componentes usan las primitivas de Reka directamente (Popover, DropdownMenu,
 * ContextMenu, Dialog); estas constantes les dan a todas la misma piel: panel blanco
 * de alto contraste, sombra con desplazamiento y la animación de entrada/salida de
 * `main.css` (`.ui-pop`, `.ui-dialog`), que se apaga con `prefers-reduced-motion`.
 */

/** Popover y menú desplegable o contextual. */
export const FLOATING_PANEL
  = 'ui-pop z-50 rounded-[var(--radius-surface)] border border-separator bg-raised p-1 text-content shadow-popover'

/** Elemento de menú: resaltado neutro, nunca Ruby (Ruby es solo primaria y foco). */
export const MENU_ITEM
  = 'flex min-h-[var(--control-min)] cursor-default select-none items-center gap-2 rounded-[var(--radius-control)] px-2 text-[length:var(--text-body)] outline-none data-[highlighted]:bg-fill-selected data-[disabled]:opacity-50'

/** Cabecera de grupo dentro de un menú o lista: versalitas de panel. */
export const MENU_LABEL
  = 'px-2 pb-1 pt-2 text-[length:var(--text-caption)] font-medium uppercase tracking-[0.06em] text-secondary'

export const MENU_SEPARATOR = 'my-1 h-px bg-separator'

/** Velo único detrás de cualquier diálogo. */
export const SCRIM = 'ui-scrim fixed inset-0 z-40 bg-scrim'

/** Diálogo centrado arriba (paleta, atajos, ajustes de tiempo). */
export const DIALOG_PANEL
  = 'ui-dialog fixed left-1/2 z-50 -translate-x-1/2 rounded-[var(--radius-surface)] border border-separator bg-raised text-content shadow-dialog'
