// @vitest-environment node
import type { ProjectFile, Version } from '../../shared/redmine/types'
import { describe, expect, it } from 'vitest'
import { formatBytes, groupFilesByVersion } from '../../shared/redmine/files'

function file(id: number, filename: string, version?: { id: number, name: string }): ProjectFile {
  return { id, filename, filesize: 10, content_url: '', created_on: '2026-10-15T10:00:00Z', version }
}

describe('archivos', () => {
  it('agrupa por versión, primero los sueltos y las versiones por fecha', () => {
    const versions: Version[] = [
      { id: 2, name: 'v2', status: 'open', due_date: '2026-12-01' },
      { id: 1, name: 'v1', status: 'closed', due_date: '2026-09-01' },
    ]
    const groups = groupFilesByVersion([
      file(1, 'b.pdf', { id: 2, name: 'v2' }),
      file(2, 'z.txt'),
      file(3, 'a.pdf', { id: 1, name: 'v1' }),
      file(4, 'a.txt'),
      file(5, 'x.zip', { id: 9, name: 'Compartida' }),
    ], versions)
    expect(groups.map(g => g.version?.name ?? 'sin')).toEqual(['sin', 'v1', 'v2', 'Compartida'])
    expect(groups[0]!.files.map(f => f.filename)).toEqual(['a.txt', 'z.txt'])
  })

  it('formatea tamaños', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(48 * 1024)).toBe('48 KB')
    expect(formatBytes(3.2 * 1024 * 1024)).toBe('3,2 MB')
  })
})
