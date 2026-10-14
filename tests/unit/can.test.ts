import type { CurrentUser, Project, RoleDetail } from '../../shared/redmine/types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import Can from '../../app/components/Can.vue'
import { vCan } from '../../app/directives/can'
import { useSessionStore } from '../../app/stores/session'
import { buildPermissionMap } from '../../shared/redmine/permissions'

/**
 * `<Can>` y `v-can` son lo que decide si una acción se ve (F1-T07). Si se rompen,
 * la app enseña botones que Redmine va a rechazar, que es justo lo que queremos evitar.
 */
const PROJECT_ID = 1

const projects: Project[] = [{
  id: PROJECT_ID,
  name: 'Portal Web',
  identifier: 'portal-web',
  status: 1,
  enabled_modules: [{ id: 1, name: 'issue_tracking' }, { id: 2, name: 'time_tracking' }],
}]

const developerRole: RoleDetail = { id: 4, name: 'Desarrollador', permissions: ['view_issues', 'log_time'] }
const clientRole: RoleDetail = { id: 6, name: 'Cliente', permissions: ['view_issues'] }

function userWith(role: RoleDetail): CurrentUser {
  return {
    id: 5,
    login: 'prueba',
    firstname: 'Ana',
    lastname: 'Prueba',
    admin: false,
    memberships: [{ id: 1, project: { id: PROJECT_ID, name: 'Portal Web' }, roles: [{ id: role.id, name: role.name }] }],
    groups: [],
  }
}

function sessionWith(role: RoleDetail): void {
  const session = useSessionStore()
  session.user = userWith(role)
  session.catalogs.projects = projects
  session.permissions = buildPermissionMap(userWith(role), new Map([[role.id, role]]), projects)
}

beforeEach(() => setActivePinia(createPinia()))

describe('<Can>', () => {
  it('muestra el contenido cuando el permiso existe', () => {
    sessionWith(developerRole)
    const component = mount(Can, {
      props: { permission: 'log_time', project: PROJECT_ID },
      slots: { default: () => 'Registrar tiempo' },
    })
    expect(component.text()).toContain('Registrar tiempo')
  })

  it('oculta el contenido cuando falta el permiso', () => {
    sessionWith(clientRole)
    const component = mount(Can, {
      props: { permission: 'log_time', project: PROJECT_ID },
      slots: { default: () => 'Registrar tiempo' },
    })
    expect(component.text()).not.toContain('Registrar tiempo')
  })

  it('con mode="disabled" lo deja visible y avisa del motivo', () => {
    sessionWith(clientRole)
    const component = mount(Can, {
      props: { permission: 'log_time', project: PROJECT_ID, mode: 'disabled' },
      slots: {
        default: (props: { allowed: boolean, reason: string }) =>
          `${props.allowed ? 'activo' : 'apagado'}: ${props.reason}`,
      },
    })
    expect(component.text()).toContain('apagado')
    expect(component.text()).toContain('no tiene permiso')
  })

  it('sin sesión no muestra nada', () => {
    const component = mount(Can, {
      props: { permission: 'view_issues', project: PROJECT_ID },
      slots: { default: () => 'Lista' },
    })
    expect(component.text()).not.toContain('Lista')
  })
})

describe('v-can', () => {
  const host = (template: string) =>
    mount({ template }, { global: { directives: { can: vCan } } })

  it('deja el elemento visible cuando el permiso existe', () => {
    sessionWith(developerRole)
    const component = host(`<button v-can="{ permission: 'log_time', project: ${PROJECT_ID} }">Registrar</button>`)
    expect(component.find('button').element.style.display).toBe('')
    expect(component.find('button').element.hidden).toBe(false)
  })

  it('oculta el elemento cuando falta el permiso', () => {
    sessionWith(clientRole)
    const component = host(`<button v-can="{ permission: 'log_time', project: ${PROJECT_ID} }">Registrar</button>`)
    expect(component.find('button').element.style.display).toBe('none')
    expect(component.find('button').element.hidden).toBe(true)
  })

  it('acepta el permiso como texto, sin proyecto', () => {
    sessionWith(developerRole)
    expect(host(`<button v-can="'log_time'">Registrar</button>`).find('button').element.hidden).toBe(false)
    expect(host(`<button v-can="'delete_issues'">Borrar</button>`).find('button').element.hidden).toBe(true)
  })

  it('con el modificador .disabled lo apaga y explica el motivo', () => {
    sessionWith(clientRole)
    const button = host(
      `<button v-can.disabled="{ permission: 'log_time', project: ${PROJECT_ID} }">Registrar</button>`,
    ).find('button').element

    expect(button.hidden).toBe(false)
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.getAttribute('title')).toContain('no tiene permiso')
  })
})
