import { describe, expect, it } from 'vitest'
import { fromUrl, toRedmineQuery } from '../../shared/redmine/filters'
import { activeView, PRESET_VIEWS, viewLocation } from '../../shared/redmine/views'

describe('vistas predefinidas', () => {
  it('cada vista sobrevive al viaje por la URL', () => {
    for (const view of PRESET_VIEWS) {
      expect(fromUrl(viewLocation(view).query.f)).toEqual(view.sentence)
    }
  })

  it('"Vencen esta semana" resuelve la semana al consultar', () => {
    const view = PRESET_VIEWS.find(v => v.id === 'due-this-week')!
    const query = toRedmineQuery(view.sentence, { now: new Date(2026, 9, 15) })
    expect(query.due_date).toBe('><2026-10-12|2026-10-18')
    expect(query.status_id).toBe('open')
  })

  it('reconoce la vista activa solo si la frase coincide', () => {
    const mine = PRESET_VIEWS[0]!
    expect(activeView(viewLocation(mine).query.f)?.id).toBe('mine')
    expect(activeView('assigned_to_id::me')).toBeUndefined()
    expect(activeView(null)).toBeUndefined()
  })
})
