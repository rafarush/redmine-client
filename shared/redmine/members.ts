import type { ProjectMember } from './types'

/**
 * Miembros de un proyecto (F6-T05): una fila por persona o grupo con sus roles.
 * Redmine devuelve una membresía por persona, pero los roles heredados de un grupo
 * vienen repetidos; aquí se juntan y se quitan los duplicados.
 */

export interface MemberRow {
  kind: 'user' | 'group'
  id: number
  name: string
  roles: string[]
}

export function groupMembers(memberships: ProjectMember[]): { people: MemberRow[], groups: MemberRow[] } {
  const rows = new Map<string, MemberRow>()
  for (const membership of memberships) {
    const principal = membership.user ?? membership.group
    if (!principal) continue
    const kind = membership.user ? 'user' : 'group'
    const key = `${kind}:${principal.id}`
    const row = rows.get(key) ?? { kind, id: principal.id, name: principal.name, roles: [] }
    for (const role of membership.roles) {
      if (!row.roles.includes(role.name)) row.roles.push(role.name)
    }
    rows.set(key, row)
  }
  const byName = (a: MemberRow, b: MemberRow) => a.name.localeCompare(b.name, 'es')
  const all = [...rows.values()]
  return {
    people: all.filter(r => r.kind === 'user').sort(byName),
    groups: all.filter(r => r.kind === 'group').sort(byName),
  }
}

/** Personas por rol, para la cabecera "3 Desarrollador · 1 Cliente". */
export function countByRole(rows: MemberRow[]): { role: string, count: number }[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    for (const role of row.roles) counts.set(role, (counts.get(role) ?? 0) + 1)
  }
  return [...counts.entries()].map(([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count || a.role.localeCompare(b.role, 'es'))
}
