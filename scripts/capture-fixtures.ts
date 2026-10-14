/**
 * Captura respuestas del Redmine local en tests/fixtures (F0-T07).
 *
 *   docker compose -f docker/compose.dev.yml up -d && pnpm seed && pnpm capture:fixtures
 *
 * Usa la clave del usuario `desarrollador` a propósito: lo que ve un usuario
 * normal es el caso que hay que poder reproducir en los tests.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = process.env.REDMINE_URL ?? 'http://localhost:3080'
const TARGET_DIR = fileURLToPath(new URL('../tests/fixtures/', import.meta.url))

/** Rutas que la app pide al arrancar y en la lista de tareas. */
const PATHS = [
  '/users/current.json?include=memberships,groups',
  '/roles.json',
  '/projects.json?include=trackers,enabled_modules&limit=100',
  '/projects/portal-web.json?include=trackers,issue_categories,issue_custom_fields,time_entry_activities,enabled_modules',
  '/projects/portal-web/memberships.json',
  '/projects/portal-web/versions.json',
  '/trackers.json',
  '/issue_statuses.json',
  '/enumerations/issue_priorities.json',
  '/enumerations/time_entry_activities.json',
  '/issues.json?assigned_to_id=me&status_id=open&limit=25',
  '/issues.json?status_id=*&limit=25',
  '/time_entries.json?user_id=me&limit=25',
]

const apiKey = execFileSync(
  'docker',
  ['compose', '-f', 'docker/compose.dev.yml', 'exec', '-T', 'redmine', 'bundle', 'exec', 'rails', 'runner',
    'puts User.find_by_login("desarrollador").api_key'],
  { encoding: 'utf8' },
).trim()

if (!/^[0-9a-f]{40}$/.test(apiKey)) {
  throw new Error('No se obtuvo la API key de "desarrollador". ¿Ejecutaste pnpm seed?')
}

/** Nombre de archivo legible a partir de la ruta. */
function fileNameFor(path: string): string {
  return `${path
    .replace(/^\//, '')
    .replace(/\.json/, '')
    .replace(/[?&=,*]/g, '-')
    .replace(/\//g, '_')
    .replace(/-+/g, '-')
    .replace(/-$/, '')}.json`
}

mkdirSync(TARGET_DIR, { recursive: true })

const index: Record<string, string> = {}

for (const path of PATHS) {
  const response = await fetch(`${BASE}${path}`, { headers: { 'X-Redmine-API-Key': apiKey } })
  if (!response.ok) throw new Error(`GET ${path} → ${response.status}`)
  const body = await response.json()
  const file = fileNameFor(path)
  writeFileSync(`${TARGET_DIR}${file}`, `${JSON.stringify(body, null, 2)}\n`)
  index[path] = file
  console.log(`  ${path} → ${file}`)
}

/*
 * El detalle de cada rol, que F1 necesita para armar los permisos. Los ids dependen
 * de la instancia, así que se resuelven aquí en vez de escribirlos a mano.
 */
const { roles } = JSON.parse(
  readFileSync(`${TARGET_DIR}${index['/roles.json']!}`, 'utf8'),
) as { roles: Array<{ id: number, name: string }> }

for (const role of roles) {
  const path = `/roles/${role.id}.json`
  const response = await fetch(`${BASE}${path}`, { headers: { 'X-Redmine-API-Key': apiKey } })
  if (!response.ok) throw new Error(`GET ${path} → ${response.status}`)
  const file = fileNameFor(path)
  writeFileSync(`${TARGET_DIR}${file}`, `${JSON.stringify(await response.json(), null, 2)}\n`)
  index[path] = file
  console.log(`  ${path} (${role.name}) → ${file}`)
}

/** También el 401, para probar el camino de clave inválida. */
const unauthorized = await fetch(`${BASE}/users/current.json`, { headers: { 'X-Redmine-API-Key': '0'.repeat(40) } })
writeFileSync(`${TARGET_DIR}error-401.json`, `${JSON.stringify({ status: unauthorized.status }, null, 2)}\n`)

writeFileSync(`${TARGET_DIR}index.json`, `${JSON.stringify(index, null, 2)}\n`)
console.log(`\n${PATHS.length} fixtures en tests/fixtures/`)
