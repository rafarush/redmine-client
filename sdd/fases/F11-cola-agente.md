# F11 · Cola de Agente e Integraciones IA

**Objetivo:** una sección donde se encolan tareas de Redmine y un agente configurado (inicialmente Claude Code) las implementa de una en una: rama propia, pruebas, commits y PR, cambiando el estado de la tarea en Redmine según avanza. Los commits y la PR **no llevan coautoría ni firma del agente**.

**Depende de:** F2c (workspace, mapeo de estados), F3 (cambio de estado de una tarea)

## Tareas

- [x] **F11-T01** ADR-009 y modelo — documentar la arquitectura (runner local aparte) y crear la lógica pura en `shared/agent/` (config, cola, transiciones) con tests. · ✔ 2077846
  - _Acepta:_ ADR-009 en `01-arquitectura.md`; tests de `sanitizeAgentConfig` y de las transiciones de la cola en verde.

- [ ] **F11-T02** Runner local — `agent-runner/` (Node, `node:http`): escucha solo en `127.0.0.1`, token aleatorio al arrancar, CORS limitado al origen de la app, repo fijo en `agent-runner.config.json`; endpoints para encolar/cancelar y SSE de eventos. Script `pnpm agent:runner`.
  - _Depende:_ F11-T01
  - _Acepta:_ sin token responde 401; otro origen no recibe cabeceras CORS; el token no sale en logs.

- [ ] **F11-T03** Flujo por tarea — rama `agent/<id>-<slug>`, `claude -p` (stream-json), verificación (`lint`, `typecheck`, `test`), `git push` y `gh pr create`. Sin `Co-Authored-By` ni "Generated with": se pasa `attribution` vacío al agente y se comprueba el `git log` antes de empujar.
  - _Depende:_ F11-T02
  - _Acepta:_ test con un `claude` falso recorre el flujo; un commit con coautoría se reescribe antes del push; árbol sucio se rechaza.

- [ ] **F11-T04** Store y composables — `app/stores/agent.ts` (config no secreta + cola en `localStorage`), `useAgentRunner` (HTTP/SSE) y `useAgentQueue`. El token del runner no va a `localStorage`.
  - _Depende:_ F11-T01
  - _Acepta:_ recargar conserva la cola; el token no aparece en el almacenamiento del navegador.

- [ ] **F11-T05** Integraciones IA — `AgentIntegrationsDialog` (agente, URL del runner, token, rama base, comandos de prueba, mapeo de estados, "Probar conexión") y entrada en el menú de cuenta.
  - _Depende:_ F11-T04
  - _Acepta:_ funciona con teclado; "Probar conexión" informa éxito o motivo del fallo.

- [ ] **F11-T06** Página Cola de Agente — `/agent` con la lista (estado con icono + texto, log, enlace a la PR, iniciar/pausar/cancelar/reintentar), alta desde el menú de tarea y estado vacío con "Configurar agente". Entrada en la navegación.
  - _Depende:_ F11-T05
  - _Acepta:_ sin agente configurado se ve el botón que abre el modal; checklist de `02-diseno.md` pasada.

- [ ] **F11-T07** Estados en Redmine — al cambiar la fase de una tarea de la cola, la app aplica el estado mapeado con `useIssueChange` respetando `allowed_statuses`; si la transición no está permitida, avisa y sigue.
  - _Depende:_ F11-T04
  - _Acepta:_ test del mapeo fase → estado; una transición no permitida no rompe la cola.

- [ ] **F11-T08** E2E y cierre — Playwright (1280 y 375 px) con un runner falso.
  - _Depende:_ F11-T06, F11-T07
  - _Acepta:_ sin agente → modal; con runner falso se ven los cambios de estado y el enlace a la PR.

## Definición de hecho

Encolar una tarea pequeña hace que el agente cree la rama, pase las pruebas, abra la PR sin coautoría y deje la tarea en revisión en Redmine.
