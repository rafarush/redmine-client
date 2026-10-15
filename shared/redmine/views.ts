import type { FilterSentence } from './filters'
import { relativeValue, toUrl } from './filters'

/**
 * Vistas predefinidas de la sidebar (F2-T05). Son frases normales: al abrirlas se
 * pueden editar en la lista, y cada una es un enlace `/?f=...` que funciona en otra pestaña.
 */
export interface PresetView {
  id: string
  label: string
  icon: string
  sentence: FilterSentence
}

const OPEN: FilterSentence['conditions'][number] = { field: 'status_id', operator: '=', values: ['open'] }

export const PRESET_VIEWS: readonly PresetView[] = [
  {
    id: 'mine',
    label: 'Mis tareas',
    icon: 'lucide:user-round',
    sentence: { conditions: [{ field: 'assigned_to_id', operator: '=', values: ['me'] }, OPEN] },
  },
  {
    id: 'created',
    label: 'Creadas por mí',
    icon: 'lucide:pen-line',
    sentence: { conditions: [{ field: 'author_id', operator: '=', values: ['me'] }] },
  },
  {
    id: 'open',
    label: 'Todas las abiertas',
    icon: 'lucide:circle-dot',
    sentence: { conditions: [OPEN] },
  },
  {
    id: 'due-this-week',
    label: 'Vencen esta semana',
    icon: 'lucide:calendar-clock',
    sentence: { conditions: [{ field: 'due_date', operator: '><', values: [relativeValue('this_week')] }, OPEN] },
  },
]

/** Ruta de la vista, con la frase en `?f=`. */
export function viewLocation(view: PresetView): { path: string, query: { f: string } } {
  return { path: '/', query: { f: toUrl(view.sentence) } }
}

/** Vista cuya frase es exactamente la de la URL, para marcarla como actual. */
export function activeView(f: string | null | undefined): PresetView | undefined {
  if (!f) return undefined
  return PRESET_VIEWS.find(view => toUrl(view.sentence) === f)
}
