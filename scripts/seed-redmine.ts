/**
 * Prepara el Redmine local con datos de prueba (F0-T06).
 *
 *   docker compose -f docker/compose.dev.yml up -d
 *   pnpm seed
 *
 * Hace dos cosas que la API REST no permite por sí sola (habilitar la propia API
 * y crear un rol), con `rails runner` dentro del contenedor; el resto va por REST.
 * Es idempotente: volver a ejecutarlo no duplica nada.
 */
import { execFileSync } from 'node:child_process'

const BASE = process.env.REDMINE_URL ?? 'http://localhost:3080'
const COMPOSE = ['compose', '-f', 'docker/compose.dev.yml']

/** Permisos del rol Cliente: puede mirar y comentar, pero no registrar tiempo. */
const PERMISOS_CLIENTE = [
  'view_issues', 'add_issues', 'add_issue_notes', 'save_queries',
  'view_time_entries', 'view_wiki_pages', 'view_news', 'view_files',
]

function rails(ruby: string): string {
  return execFileSync('docker', [...COMPOSE, 'exec', '-T', 'redmine', 'bundle', 'exec', 'rails', 'runner', ruby], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  }).trim()
}

let apiKey = ''

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const respuesta = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Redmine-API-Key': apiKey },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!respuesta.ok) {
    const texto = await respuesta.text()
    throw new Error(`${method} ${path} → ${respuesta.status}: ${texto.slice(0, 400)}`)
  }
  return respuesta.status === 204 ? (undefined as T) : await respuesta.json() as T
}

/** Devuelve el id del primer elemento cuyo campo coincide, o null. */
function buscar<T extends Record<string, unknown>>(lista: T[], campo: keyof T, valor: unknown): T | null {
  return lista.find(item => item[campo] === valor) ?? null
}

async function paginar<T>(path: string, clave: string): Promise<T[]> {
  const todos: T[] = []
  for (let offset = 0; ; offset += 100) {
    const separador = path.includes('?') ? '&' : '?'
    const pagina = await api<Record<string, unknown>>('GET', `${path}${separador}limit=100&offset=${offset}`)
    const lote = pagina[clave] as T[]
    todos.push(...lote)
    if (todos.length >= Number(pagina.total_count ?? 0) || lote.length === 0) return todos
  }
}

// ---------------------------------------------------------------- preparación

console.log('Preparando Redmine…')

rails(`
  Setting.rest_api_enabled = '1'
  Setting.text_formatting = 'common_mark'
  if Tracker.count.zero?
    Redmine::DefaultData::Loader.load('es')
    puts 'datos por defecto cargados'
  end
  unless Role.find_by(name: 'Cliente')
    rol = Role.new(name: 'Cliente', permissions: ${JSON.stringify(PERMISOS_CLIENTE).replace(/"/g, '\'')}.map(&:to_sym))
    rol.issues_visibility = 'default'
    rol.save!
    puts 'rol Cliente creado'
  end
`)

apiKey = rails('puts User.find_by_login("admin").api_key')
if (!/^[0-9a-f]{40}$/.test(apiKey)) throw new Error(`No se obtuvo la API key del admin: ${apiKey}`)

// ---------------------------------------------------------------- catálogos

const { trackers } = await api<{ trackers: Array<{ id: number, name: string }> }>('GET', '/trackers.json')
const { issue_statuses: estados } = await api<{ issue_statuses: Array<{ id: number, name: string, is_closed?: boolean }> }>('GET', '/issue_statuses.json')
const { issue_priorities: prioridades } = await api<{ issue_priorities: Array<{ id: number, name: string }> }>('GET', '/enumerations/issue_priorities.json')
const { time_entry_activities: actividades } = await api<{ time_entry_activities: Array<{ id: number, name: string }> }>('GET', '/enumerations/time_entry_activities.json')

const idsTracker = trackers.map(t => t.id)
const abiertos = estados.filter(e => !e.is_closed)
const cerrados = estados.filter(e => e.is_closed)

// ---------------------------------------------------------------- usuarios

const { roles } = await api<{ roles: Array<{ id: number, name: string }> }>('GET', '/roles.json')
const rolDesarrollador = buscar(roles, 'name', 'Desarrollador') ?? buscar(roles, 'name', 'Developer')
const rolCliente = buscar(roles, 'name', 'Cliente')
if (!rolDesarrollador || !rolCliente) throw new Error('Faltan los roles Desarrollador o Cliente')

// Sin `status`: Redmine devuelve los activos, que es lo que el seed necesita.
const usuariosExistentes = await paginar<{ id: number, login: string }>('/users.json', 'users')

async function asegurarUsuario(login: string, firstname: string, lastname: string): Promise<number> {
  const existente = buscar(usuariosExistentes, 'login', login)
  if (existente) return existente.id
  const { user } = await api<{ user: { id: number } }>('POST', '/users.json', {
    user: { login, firstname, lastname, mail: `${login}@ejemplo.local`, password: 'Prueba.1234', must_change_passwd: false },
  })
  console.log(`  usuario ${login} creado`)
  return user.id
}

const idDesarrollador = await asegurarUsuario('desarrollador', 'Dani', 'Desarrollo')
const idCliente = await asegurarUsuario('cliente', 'Carmen', 'Cliente')

// ---------------------------------------------------------------- proyectos

const proyectosExistentes = await paginar<{ id: number, identifier: string }>('/projects.json', 'projects')

async function asegurarProyecto(
  identifier: string,
  name: string,
  description: string,
  parentId?: number,
): Promise<number> {
  const existente = buscar(proyectosExistentes, 'identifier', identifier)
  if (existente) return existente.id
  const { project } = await api<{ project: { id: number } }>('POST', '/projects.json', {
    project: {
      name,
      identifier,
      description,
      parent_id: parentId,
      is_public: false,
      tracker_ids: idsTracker,
      enabled_module_names: ['issue_tracking', 'time_tracking', 'wiki', 'news', 'files'],
    },
  })
  console.log(`  proyecto ${identifier} creado`)
  return project.id
}

const idPortal = await asegurarProyecto('portal-web', 'Portal Web', 'Portal público de clientes.')
const idMovil = await asegurarProyecto('portal-movil', 'Portal Web · Móvil', 'App móvil del portal.', idPortal)
const idSoporte = await asegurarProyecto('soporte-interno', 'Soporte Interno', 'Incidencias del equipo interno.')

async function asegurarMiembro(projectId: number, userId: number, roleId: number): Promise<void> {
  const { memberships } = await api<{ memberships: Array<{ user?: { id: number } }> }>(
    'GET', `/projects/${projectId}/memberships.json?limit=100`,
  )
  if (memberships.some(m => m.user?.id === userId)) return
  await api('POST', `/projects/${projectId}/memberships.json`, {
    membership: { user_id: userId, role_ids: [roleId] },
  })
}

for (const proyecto of [idPortal, idMovil, idSoporte]) {
  await asegurarMiembro(proyecto, idDesarrollador, rolDesarrollador.id)
  await asegurarMiembro(proyecto, idCliente, rolCliente.id)
}

// ---------------------------------------------------------------- versiones

async function asegurarVersion(projectId: number, name: string, dueDate: string): Promise<number> {
  const { versions } = await api<{ versions: Array<{ id: number, name: string }> }>('GET', `/projects/${projectId}/versions.json`)
  const existente = buscar(versions, 'name', name)
  if (existente) return existente.id
  const { version } = await api<{ version: { id: number } }>('POST', `/projects/${projectId}/versions.json`, {
    version: { name, due_date: dueDate, status: 'open' },
  })
  console.log(`  versión ${name} creada`)
  return version.id
}

const version1 = await asegurarVersion(idPortal, '1.0 · Lanzamiento', '2026-11-28')
const version2 = await asegurarVersion(idPortal, '1.1 · Mejoras', '2027-01-30')

// ---------------------------------------------------------------- tareas

const ASUNTOS = [
  'Arreglar el inicio de sesión con SSO', 'Exportar el listado a CSV', 'Error en el paso de pago',
  'Revisar el contraste del tema oscuro', 'Acelerar la búsqueda de clientes', 'Añadir filtro por versión',
  'Corregir el formato de fechas', 'Cerrar sesión no limpia la caché', 'Subida de adjuntos falla con PDF grandes',
  'Traducir los mensajes de error', 'Paginar el listado de proyectos', 'Avisar cuando la tarea vence hoy',
  'Quitar el doble scroll en móvil', 'Permitir reordenar columnas', 'Guardar el último filtro usado',
  'Mejorar el mensaje de sesión caducada', 'Validar el correo al registrarse', 'Recordar el ancho del panel',
  'Soportar atajos de teclado', 'Registrar tiempo desde el listado',
]

// Cuenta todas las tareas, no solo las de un proyecto: el seed las reparte entre los tres.
const { total_count: tareasExistentes } = await api<{ total_count: number }>('GET', '/issues.json?status_id=*&limit=1')

const tareasCreadas: number[] = []

if (tareasExistentes < 40) {
  const objetivo = 42
  for (let i = 0; i < objetivo; i++) {
    const proyecto = i % 5 === 0 ? idSoporte : i % 7 === 0 ? idMovil : idPortal
    const cerrada = i % 4 === 3
    const estado = cerrada ? cerrados[i % cerrados.length]! : abiertos[i % abiertos.length]!
    const asignado = i % 3 === 0 ? idDesarrollador : i % 3 === 1 ? undefined : idCliente

    const { issue } = await api<{ issue: { id: number } }>('POST', '/issues.json', {
      issue: {
        project_id: proyecto,
        tracker_id: idsTracker[i % idsTracker.length],
        subject: `${ASUNTOS[i % ASUNTOS.length]}${i >= ASUNTOS.length ? ` (${Math.floor(i / ASUNTOS.length) + 1})` : ''}`,
        description: 'Tarea de prueba creada por `pnpm seed`.',
        status_id: estado.id,
        priority_id: prioridades[i % prioridades.length]!.id,
        assigned_to_id: asignado,
        fixed_version_id: proyecto === idPortal ? (i % 2 === 0 ? version1 : version2) : undefined,
        estimated_hours: (i % 8) + 1,
        done_ratio: cerrada ? 100 : (i % 5) * 20,
      },
    })
    tareasCreadas.push(issue.id)
  }
  console.log(`  ${objetivo} tareas creadas`)
}
else {
  console.log(`  las tareas ya existían (${tareasExistentes})`)
}

// ---------------------------------------------------------------- tiempo

const { total_count: tiemposExistentes } = await api<{ total_count: number }>('GET', '/time_entries.json?limit=1')

if (tiemposExistentes === 0 && tareasCreadas.length > 0) {
  const hoy = new Date()
  for (let i = 0; i < 12; i++) {
    const fecha = new Date(hoy)
    fecha.setDate(hoy.getDate() - (i % 6))
    await api('POST', '/time_entries.json', {
      time_entry: {
        issue_id: tareasCreadas[i]!,
        // A nombre del desarrollador, no del admin: es el usuario con el que se prueba.
        user_id: idDesarrollador,
        hours: [0.5, 1, 1.5, 2, 3][i % 5],
        activity_id: actividades[i % actividades.length]!.id,
        spent_on: fecha.toISOString().slice(0, 10),
        comments: 'Trabajo de prueba.',
      },
    })
  }
  console.log('  12 entradas de tiempo creadas')
}

// ---------------------------------------------------------------- wiki

await api('PUT', `/projects/${idPortal}/wiki/Wiki.json`, {
  wiki_page: {
    text: [
      '# Portal Web',
      '',
      'Página de prueba creada por `pnpm seed`.',
      '',
      '## Entornos',
      '',
      '- Producción: portal.ejemplo.local',
      '- Pruebas: pruebas.portal.ejemplo.local',
    ].join('\n'),
    comments: 'Creada por el seed',
  },
})
console.log('  página de wiki al día')

// ---------------------------------------------------------------- resumen

const claves = rails(`
  %w[admin desarrollador cliente].each do |login|
    u = User.find_by_login(login)
    puts "#{login}\\t#{u.api_key}" if u
  end
`)

console.log('\nListo. Redmine en', BASE)
console.log('\nUsuario        Contraseña      API key')
for (const linea of claves.split('\n')) {
  const [login, key] = linea.trim().split('\t')
  const password = login === 'admin' ? 'admin' : 'Prueba.1234'
  console.log(`${login!.padEnd(14)} ${password.padEnd(15)} ${key}`)
}
console.log('\nEl rol Cliente no tiene log_time: úsalo para comprobar que la app oculta registrar tiempo.')
