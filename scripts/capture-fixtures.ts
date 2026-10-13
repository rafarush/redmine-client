/**
 * Captura respuestas del Redmine local en tests/fixtures (F0-T07).
 *
 *   docker compose -f docker/compose.dev.yml up -d && pnpm seed && pnpm capture:fixtures
 *
 * Usa la clave del usuario `desarrollador` a propósito: lo que ve un usuario
 * normal es el caso que hay que poder reproducir en los tests.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = process.env.REDMINE_URL ?? 'http://localhost:3080'
const DESTINO = fileURLToPath(new URL('../tests/fixtures/', import.meta.url))

/** Rutas que la app pide al arrancar y en la lista de tareas. */
const RUTAS = [
  '/users/current.json?include=memberships,groups',
  '/projects.json?include=trackers,enabled_modules&limit=100',
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
function nombreArchivo(ruta: string): string {
  return `${ruta
    .replace(/^\//, '')
    .replace(/\.json/, '')
    .replace(/[?&=,*]/g, '-')
    .replace(/\//g, '_')
    .replace(/-+/g, '-')
    .replace(/-$/, '')}.json`
}

mkdirSync(DESTINO, { recursive: true })

const indice: Record<string, string> = {}

for (const ruta of RUTAS) {
  const respuesta = await fetch(`${BASE}${ruta}`, { headers: { 'X-Redmine-API-Key': apiKey } })
  if (!respuesta.ok) throw new Error(`GET ${ruta} → ${respuesta.status}`)
  const cuerpo = await respuesta.json()
  const archivo = nombreArchivo(ruta)
  writeFileSync(`${DESTINO}${archivo}`, `${JSON.stringify(cuerpo, null, 2)}\n`)
  indice[ruta] = archivo
  console.log(`  ${ruta} → ${archivo}`)
}

/** También el 401, para probar el camino de clave inválida. */
const noAutorizado = await fetch(`${BASE}/users/current.json`, { headers: { 'X-Redmine-API-Key': '0'.repeat(40) } })
writeFileSync(`${DESTINO}error-401.json`, `${JSON.stringify({ status: noAutorizado.status }, null, 2)}\n`)

writeFileSync(`${DESTINO}index.json`, `${JSON.stringify(indice, null, 2)}\n`)
console.log(`\n${RUTAS.length} fixtures en tests/fixtures/`)
