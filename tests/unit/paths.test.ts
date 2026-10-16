// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isPathAllowed } from '../../shared/redmine/guards'
import { attachmentDownloadPath, encodeSegment } from '../../shared/redmine/paths'

describe('segmentos para el proxy', () => {
  it('escapa lo que encodeURIComponent deja pasar', () => {
    expect(encodeSegment('Guía (v2)!')).toBe('Gu%C3%ADa%20%28v2%29%21')
  })

  it('las rutas resultantes pasan el filtro del proxy', () => {
    expect(isPathAllowed(`/projects/p/wiki/${encodeSegment('Notas (Ana\'s)')}.json`)).toBe(true)
    const download = attachmentDownloadPath({ id: 7, filename: 'informe final (1).pdf' }).replace('/api/redmine', '')
    expect(isPathAllowed(download)).toBe(true)
  })
})
