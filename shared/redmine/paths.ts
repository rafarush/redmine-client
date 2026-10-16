/**
 * Segmentos de ruta seguros para el proxy (`shared/redmine/guards.ts` solo deja
 * pasar letras, dígitos, `-`, `.`, `_` y `%`). `encodeURIComponent` deja sin
 * escapar `! ' ( ) *`, así que se escapan aparte.
 */
export function encodeSegment(text: string): string {
  return encodeURIComponent(text).replace(/[!'()*~]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

/** Descarga de un adjunto por el proxy de la app, que añade la clave de la sesión. */
export function attachmentDownloadPath(attachment: { id: number, filename: string }): string {
  return `/api/redmine/attachments/download/${attachment.id}/${encodeSegment(attachment.filename)}`
}
