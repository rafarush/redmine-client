import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'

/**
 * Configuración del runner (F11-T02). Vive en el equipo, junto al repo: el cliente nunca
 * manda rutas ni comandos, solo el contenido de la tarea.
 */

const schema = z.object({
  /** Repo donde trabaja el agente. */
  repoPath: z.string().min(1),
  port: z.number().int().min(1024).max(65535).default(4317),
  /** Único origen web que recibe cabeceras CORS. */
  allowedOrigin: z.string().url().default('http://localhost:3000'),
  /** Comandos que deben pasar antes de abrir la PR. */
  verifyCommands: z.array(z.string().min(1)).default(['pnpm lint', 'pnpm typecheck', 'pnpm test']),
  /** Modo de permisos de `claude` para el agente (F11-T03). */
  permissionMode: z.enum(['acceptEdits', 'auto', 'bypassPermissions', 'dontAsk']).default('acceptEdits'),
  /** Herramientas que el agente usa sin preguntar (sin nadie delante, lo demás se deniega). */
  allowedTools: z.array(z.string().min(1)).default([
    'Read',
    'Edit',
    'Write',
    'Glob',
    'Grep',
    'Bash(pnpm *)',
    'Bash(git status*)',
    'Bash(git diff*)',
    'Bash(git add *)',
    'Bash(git commit *)',
    'Bash(git log*)',
  ]),
})

export type RunnerConfig = z.infer<typeof schema>

export const CONFIG_FILE = 'agent-runner.config.json'

export function parseRunnerConfig(raw: unknown): RunnerConfig {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.') || '(raíz)'}: ${i.message}`).join('; ')
    throw new Error(`Configuración del runner inválida: ${issues}`)
  }
  return { ...parsed.data, repoPath: resolve(parsed.data.repoPath), allowedOrigin: new URL(parsed.data.allowedOrigin).origin }
}

export function loadRunnerConfig(dir: string): RunnerConfig {
  const file = join(dir, CONFIG_FILE)
  if (!existsSync(file)) throw new Error(`Falta ${CONFIG_FILE} en ${dir}. Copia ${CONFIG_FILE.replace('.json', '.example.json')} y ajústalo.`)
  const config = parseRunnerConfig(JSON.parse(readFileSync(file, 'utf8')))
  if (!existsSync(join(config.repoPath, '.git'))) throw new Error(`repoPath no es un repositorio git: ${config.repoPath}`)
  return config
}
