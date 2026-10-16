import type { ProjectFile, Version } from './types'
import { sortVersions } from './projects'

/**
 * Archivos del proyecto (F7-T05): agrupados por versión como en Redmine (primero
 * los que no tienen versión) y tamaños legibles.
 */

export interface FileGroup {
  /** `undefined` para "Sin versión". */
  version?: { id: number, name: string }
  files: ProjectFile[]
}

export function groupFilesByVersion(files: ProjectFile[], versions: Version[] = []): FileGroup[] {
  const loose = files.filter(f => !f.version)
  const byVersion = new Map<number, ProjectFile[]>()
  for (const file of files) {
    if (file.version) byVersion.set(file.version.id, [...(byVersion.get(file.version.id) ?? []), file])
  }
  // Orden de las versiones conocidas (por fecha); las que no están en la lista, por nombre al final.
  const known = sortVersions(versions).map(v => v.id)
  const ids = [...byVersion.keys()].sort((a, b) => {
    const ia = known.indexOf(a)
    const ib = known.indexOf(b)
    if (ia >= 0 && ib >= 0) return ia - ib
    if (ia >= 0) return -1
    if (ib >= 0) return 1
    return byVersion.get(a)![0]!.version!.name.localeCompare(byVersion.get(b)![0]!.version!.name, 'es')
  })
  const byName = (a: ProjectFile, b: ProjectFile) => a.filename.localeCompare(b.filename, 'es')
  const groups: FileGroup[] = ids.map(id => ({ version: byVersion.get(id)![0]!.version!, files: byVersion.get(id)!.sort(byName) }))
  return loose.length > 0 ? [{ files: loose.sort(byName) }, ...groups] : groups
}

/** "512 B", "48 KB", "3,2 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  const mb = bytes / (1024 * 1024)
  return mb < 1024 ? `${mb.toFixed(1).replace('.', ',')} MB` : `${(mb / 1024).toFixed(1).replace('.', ',')} GB`
}
