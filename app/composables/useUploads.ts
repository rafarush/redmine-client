import { explainRejection } from '../../shared/redmine/issue-actions'

/**
 * Cola de subidas a Redmine con progreso y cancelación por archivo (F7-T05,
 * F3-T06). Cada archivo se sube a `/uploads.json` y, con su token, `attach` lo
 * añade donde toque (proyecto, tarea…). Cancelar antes de `attach` no deja nada.
 */

export type UploadState = 'uploading' | 'attaching' | 'done' | 'error' | 'cancelled'

export interface Upload {
  id: number
  name: string
  size: number
  loaded: number
  state: UploadState
  error?: string
  controller: AbortController
}

export const UPLOAD_LABEL: Record<UploadState, string> = {
  uploading: 'Subiendo',
  attaching: 'Adjuntando',
  done: 'Subido',
  error: 'Error',
  cancelled: 'Cancelado',
}

export const UPLOAD_ICON: Record<UploadState, string> = {
  uploading: 'lucide:upload',
  attaching: 'lucide:loader',
  done: 'lucide:circle-check',
  error: 'lucide:circle-alert',
  cancelled: 'lucide:circle-x',
}

let nextId = 1

export function useUploads() {
  const redmine = useRedmine()
  const uploads = ref<Upload[]>([])
  const busy = computed(() => uploads.value.some(u => u.state === 'uploading' || u.state === 'attaching'))

  function patch(id: number, changes: Partial<Upload>): void {
    uploads.value = uploads.value.map(u => u.id === id ? { ...u, ...changes } : u)
  }

  /** Sube un archivo y lo adjunta con `attach(token, file)`. Dice si quedó adjuntado. */
  async function send(file: File, attach: (token: string, file: File) => Promise<void>): Promise<boolean> {
    const upload: Upload = { id: nextId++, name: file.name, size: file.size, loaded: 0, state: 'uploading', controller: new AbortController() }
    uploads.value = [...uploads.value, upload]
    const { signal } = upload.controller
    try {
      const token = await redmine.upload(file, file.name, { signal, onProgress: loaded => patch(upload.id, { loaded }) })
      // Cancelado justo al terminar la subida: no se adjunta.
      if (signal.aborted) throw new DOMException('Subida cancelada', 'AbortError')
      patch(upload.id, { state: 'attaching', loaded: file.size })
      await attach(token, file)
      patch(upload.id, { state: 'done' })
      return true
    }
    catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') patch(upload.id, { state: 'cancelled' })
      else patch(upload.id, { state: 'error', error: explainRejection(error) })
      return false
    }
  }

  /** Varios a la vez; devuelve cuántos quedaron adjuntados. */
  async function sendAll(files: FileList | File[], attach: (token: string, file: File) => Promise<void>): Promise<number> {
    const results = await Promise.all([...files].map(file => send(file, attach)))
    return results.filter(Boolean).length
  }

  function clearFinished(): void {
    uploads.value = uploads.value.filter(u => u.state === 'uploading' || u.state === 'attaching')
  }

  return { uploads, busy, send, sendAll, clearFinished }
}
