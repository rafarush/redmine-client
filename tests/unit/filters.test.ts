// @vitest-environment node
import type { FilterSentence } from '../../shared/redmine/filters'
import { describe, expect, it } from 'vitest'
import { conditionFor, describe as describeSentence, describeConditionParts, fromUrl, isFilterField, relativeValue, resolvePeriod, toRedmineQuery, toUrl, withCondition, withoutField } from '../../shared/redmine/filters'

/**
 * La frase de filtros (F2-T01). Lo que importa aquí:
 * la URL aguanta la ida y la vuelta, y "esta semana" se resuelve al consultar.
 */

/** Jueves 15 de octubre de 2026. La semana va del lunes 12 al domingo 18. */
const NOW = new Date('2026-10-15T10:30:00')

const sentence = (...conditions: FilterSentence['conditions']): FilterSentence => ({ conditions })

describe('toRedmineQuery', () => {
  it('traduce la frase de la pantalla principal', () => {
    const query = toRedmineQuery(sentence(
      { field: 'assigned_to_id', operator: '=', values: ['me'] },
      { field: 'status_id', operator: '=', values: ['open'] },
      { field: 'project_id', operator: '=', values: ['portal-web'] },
    ), { now: NOW })

    expect(query).toEqual({ assigned_to_id: 'me', status_id: 'open', project_id: 'portal-web' })
  })

  it('une varios valores con una barra', () => {
    const query = toRedmineQuery(sentence({ field: 'status_id', operator: '=', values: ['1', '2'] }), { now: NOW })
    expect(query.status_id).toBe('1|2')
  })

  it('escribe el operador delante, salvo el igual', () => {
    const query = toRedmineQuery(sentence(
      { field: 'due_date', operator: '<=', values: ['2026-10-31'] },
      { field: 'subject', operator: '~', values: ['pago'] },
      { field: 'assigned_to_id', operator: '!', values: ['12'] },
    ), { now: NOW })

    expect(query).toEqual({ due_date: '<=2026-10-31', subject: '~pago', assigned_to_id: '!12' })
  })

  it('deja sin valores los operadores de presencia', () => {
    const query = toRedmineQuery(sentence(
      { field: 'subproject_id', operator: '!*', values: [] },
      { field: 'fixed_version_id', operator: '*', values: [] },
    ), { now: NOW })

    expect(query).toEqual({ subproject_id: '!*', fixed_version_id: '*' })
  })

  it('ignora una condición sin valores que sí los necesita', () => {
    expect(toRedmineQuery(sentence({ field: 'status_id', operator: '=', values: [] }), { now: NOW })).toEqual({})
  })

  it('excluir subproyectos es una condición más, no un caso especial', () => {
    const query = toRedmineQuery(sentence(
      { field: 'project_id', operator: '=', values: ['portal-web'] },
      { field: 'subproject_id', operator: '!*', values: [] },
    ), { now: NOW })

    expect(query).toEqual({ project_id: 'portal-web', subproject_id: '!*' })
  })
})

describe('fechas relativas', () => {
  it('resuelve los periodos contra el momento de la consulta', () => {
    expect(resolvePeriod('today', NOW)).toEqual(['2026-10-15', '2026-10-15'])
    expect(resolvePeriod('yesterday', NOW)).toEqual(['2026-10-14', '2026-10-14'])
    // La semana empieza en lunes.
    expect(resolvePeriod('this_week', NOW)).toEqual(['2026-10-12', '2026-10-18'])
    expect(resolvePeriod('last_week', NOW)).toEqual(['2026-10-05', '2026-10-11'])
    expect(resolvePeriod('this_month', NOW)).toEqual(['2026-10-01', '2026-10-31'])
    expect(resolvePeriod('last_month', NOW)).toEqual(['2026-09-01', '2026-09-30'])
  })

  it('un periodo se consulta como rango', () => {
    const query = toRedmineQuery(
      sentence({ field: 'updated_on', operator: '=', values: [relativeValue('this_week')] }),
      { now: NOW },
    )
    expect(query.updated_on).toBe('><2026-10-12|2026-10-18')
  })

  it('un solo día se consulta con igual, no con un rango', () => {
    const query = toRedmineQuery(
      sentence({ field: 'due_date', operator: '=', values: [relativeValue('today')] }),
      { now: NOW },
    )
    expect(query.due_date).toBe('2026-10-15')
  })

  it('con mayor o menor usa el extremo que toca', () => {
    const since = toRedmineQuery(
      sentence({ field: 'updated_on', operator: '>=', values: [relativeValue('this_week')] }),
      { now: NOW },
    )
    const until = toRedmineQuery(
      sentence({ field: 'due_date', operator: '<=', values: [relativeValue('this_month')] }),
      { now: NOW },
    )

    expect(since.updated_on).toBe('>=2026-10-12')
    expect(until.due_date).toBe('<=2026-10-31')
  })

  it('se guarda sin resolver: el mismo enlace da otro rango otra semana', () => {
    const saved = sentence({ field: 'updated_on', operator: '=', values: [relativeValue('this_week')] })

    // Lo que viaja en la URL sigue diciendo "esta semana".
    expect(toUrl(saved)).toContain('%40this_week')
    expect(fromUrl(toUrl(saved))).toEqual(saved)

    const thisWeek = toRedmineQuery(saved, { now: NOW })
    const nextWeek = toRedmineQuery(saved, { now: new Date('2026-10-22T10:30:00') })

    expect(thisWeek.updated_on).toBe('><2026-10-12|2026-10-18')
    expect(nextWeek.updated_on).toBe('><2026-10-19|2026-10-25')
  })

  it('una fecha escrita a mano se deja como está', () => {
    const query = toRedmineQuery(
      sentence({ field: 'due_date', operator: '><', values: ['2026-01-01', '2026-01-31'] }),
      { now: NOW },
    )
    expect(query.due_date).toBe('><2026-01-01|2026-01-31')
  })
})

describe('URL', () => {
  const full = sentence(
    { field: 'assigned_to_id', operator: '=', values: ['me'] },
    { field: 'status_id', operator: '=', values: ['1', '2'] },
    { field: 'updated_on', operator: '>=', values: [relativeValue('last_week')] },
    { field: 'subject', operator: '~', values: ['error de pago'] },
    { field: 'subproject_id', operator: '!*', values: [] },
    { field: 'cf_5', operator: '=', values: ['Urgente'] },
  )

  it('va y vuelve sin perder nada', () => {
    expect(fromUrl(toUrl(full))).toEqual(full)
    expect(toUrl(fromUrl(toUrl(full)))).toBe(toUrl(full))
  })

  it('sobrevive a un texto con los separadores dentro', () => {
    const tricky = sentence({ field: 'subject', operator: '~', values: ['a;b:c|d e'] })
    expect(fromUrl(toUrl(tricky))).toEqual(tricky)
  })

  it('una frase vacía es una URL vacía', () => {
    expect(toUrl({ conditions: [] })).toBe('')
    expect(fromUrl('')).toEqual({ conditions: [] })
    expect(fromUrl(null)).toEqual({ conditions: [] })
  })

  it('descarta lo que no entiende en vez de romperse', () => {
    const parsed = fromUrl('inventado:%3D:1;status_id:%3D:1;status_id;assigned_to_id:XX:me;subject:%7E:')
    expect(parsed).toEqual(sentence({ field: 'status_id', operator: '=', values: ['1'] }))
  })

  it('un porcentaje suelto no lanza', () => {
    expect(() => fromUrl('subject:%7E:100%')).not.toThrow()
  })

  it('acepta campos personalizados y rechaza lo que se les parece', () => {
    expect(isFilterField('cf_12')).toBe(true)
    expect(isFilterField('cf_')).toBe(false)
    expect(isFilterField('cf_x')).toBe(false)
    expect(isFilterField('drop_table')).toBe(false)
  })
})

describe('describe', () => {
  const names: Record<string, string> = { '1': 'Abierta', '2': 'En curso', 'portal-web': 'Portal Web', '4': 'Alta' }
  const lookup = (_field: string, value: string): string | undefined => names[value]

  it('lee la frase del diseño', () => {
    const text = describeSentence(sentence(
      { field: 'assigned_to_id', operator: '=', values: ['me'] },
      { field: 'status_id', operator: '=', values: ['1', '2'] },
      { field: 'project_id', operator: '=', values: ['portal-web'] },
    ), lookup)

    expect(text).toBe('Tareas asignadas a mí, en Abierta o En curso, de Portal Web')
  })

  it('dice los periodos por su nombre, no por sus fechas', () => {
    const text = describeSentence(
      sentence({ field: 'updated_on', operator: '=', values: [relativeValue('this_week')] }),
      lookup,
    )
    expect(text).toBe('Tareas actualizadas esta semana')
  })

  it('pone la negación delante para que se lea bien', () => {
    const text = describeSentence(sentence({ field: 'assigned_to_id', operator: '!', values: ['me'] }), lookup)
    expect(text).toBe('Tareas no asignadas a mí')
  })

  it('lee un rango y los extremos', () => {
    expect(describeSentence(sentence({ field: 'due_date', operator: '><', values: ['2026-01-01', '2026-01-31'] })))
      .toBe('Tareas que vencen entre 2026-01-01 y 2026-01-31')
    expect(describeSentence(sentence({ field: 'due_date', operator: '<=', values: ['2026-01-31'] })))
      .toBe('Tareas que vencen hasta 2026-01-31')
  })

  it('sin condiciones no deja la frase a medias', () => {
    expect(describeSentence({ conditions: [] })).toBe('Todas las tareas')
  })

  it('usa el valor crudo si no hay nombre para el id', () => {
    expect(describeSentence(sentence({ field: 'priority_id', operator: '=', values: ['9'] })))
      .toBe('Tareas con prioridad 9')
  })
})

describe('edición de la frase', () => {
  const base = sentence(
    { field: 'assigned_to_id', operator: '=', values: ['me'] },
    { field: 'status_id', operator: '=', values: ['open'] },
  )

  it('cambiar un token no reordena la frase', () => {
    const next = withCondition(base, { field: 'assigned_to_id', operator: '=', values: ['12'] })
    expect(next.conditions.map(c => c.field)).toEqual(['assigned_to_id', 'status_id'])
    expect(conditionFor(next, 'assigned_to_id')?.values).toEqual(['12'])
  })

  it('una condición nueva se añade al final', () => {
    const next = withCondition(base, { field: 'project_id', operator: '=', values: ['portal-web'] })
    expect(next.conditions.map(c => c.field)).toEqual(['assigned_to_id', 'status_id', 'project_id'])
  })

  it('quitar un token lo quita solo a él', () => {
    const next = withoutField(base, 'status_id')
    expect(next.conditions.map(c => c.field)).toEqual(['assigned_to_id'])
    expect(conditionFor(next, 'status_id')).toBeUndefined()
  })

  it('no toca la frase original', () => {
    withCondition(base, { field: 'status_id', operator: '=', values: ['closed'] })
    withoutField(base, 'status_id')
    expect(conditionFor(base, 'status_id')?.values).toEqual(['open'])
  })
})

describe('describeConditionParts', () => {
  it('separa las palabras de unión del valor que se puede cambiar', () => {
    expect(describeConditionParts({ field: 'assigned_to_id', operator: '=', values: ['me'] }))
      .toEqual({ lead: 'asignadas a', value: 'mí' })
    expect(describeConditionParts({ field: 'due_date', operator: '>=', values: ['2026-10-01'] }).lead)
      .toBe('que vencen desde')
    expect(describeConditionParts({ field: 'assigned_to_id', operator: '!*', values: [] }))
      .toEqual({ lead: '', value: 'sin asignadas a' })
  })
})
