import { randomBytes } from 'node:crypto'
import { createClaudeText } from './ai'
import { loadRunnerConfig } from './config'
import { EventHub, Scheduler } from './scheduler'
import { createRunnerServer } from './server'
import type { TaskExecutor } from './types'

/** Hasta F11-T03 el runner acepta tareas pero no sabe ejecutarlas. */
const executor: TaskExecutor = {
  run: () => Promise.reject(new Error('El flujo del agente aún no está implementado (F11-T03)')),
}

const config = loadRunnerConfig(process.cwd())
const token = randomBytes(24).toString('hex')
const hub = new EventHub()
const server = createRunnerServer({
  token,
  allowedOrigin: config.allowedOrigin,
  hub,
  scheduler: new Scheduler(hub, executor),
  ai: createClaudeText(),
  log: line => console.log(line),
})

// Solo en este equipo: nunca en una interfaz de red.
server.listen(config.port, '127.0.0.1', () => {
  console.log(`agent-runner en http://127.0.0.1:${config.port}  ·  repo: ${config.repoPath}`)
  // Única vez que se imprime el token: pégalo en Integraciones IA.
  console.log(`token: ${token}`)
})
