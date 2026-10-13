/**
 * Capa de red hacia Redmine. La UI nunca usa fetch directo: siempre pasa por un RedmineTransport.
 *
 * - Web:     ProxyTransport -> /api/redmine/** (Nitro) -> Redmine. La API key vive en la cookie sellada.
 * - Desktop: TauriTransport -> @tauri-apps/plugin-http -> Redmine. La API key vive en el llavero del SO.
 *
 * Implementaciones: tarea F1-T03 (proxy) y F8-T04 (tauri). Ver sdd/01-arquitectura.md.
 */
export interface RedmineRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Ruta de la API de Redmine sin host, p. ej. `/issues.json` */
  path: string
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
  /** Para /uploads.json (application/octet-stream) */
  rawBody?: Blob | ArrayBuffer
}

export interface RedmineTransport {
  readonly kind: 'proxy' | 'tauri'
  request<T>(req: RedmineRequest): Promise<T>
}

export class RedmineError extends Error {
  constructor(
    readonly status: number,
    /** Mensajes de validación que Redmine devuelve en `{ errors: [...] }` (422) */
    readonly errors: string[] = [],
  ) {
    super(errors[0] ?? `Redmine respondió ${status}`)
  }
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
