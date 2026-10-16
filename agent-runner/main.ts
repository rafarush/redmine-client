import { randomBytes } from 'node:crypto'
import { createClaudeText } from './ai'
import { loadRunnerConfig } from './config'
import { createExecutor } from './executor'
import { EventHub, Scheduler } from './scheduler'
import { createRunnerServer } from './server'

const config = loadRunnerConfig(process.cwd())
const executor = createExecutor({
  repoPath: config.repoPath,
  verifyCommands: config.verifyCommands,
  permissionMode: config.permissionMode,
  allowedTools: config.allowedTools,
  model: config.model,
})
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
