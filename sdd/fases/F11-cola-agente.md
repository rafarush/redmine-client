# F11 · Cola de Agente e Integraciones IA

**Objetivo:** una sección donde se encolan tareas de Redmine y un agente configurado (inicialmente Claude Code) las implementa de una en una: rama propia, pruebas, commits y PR, cambiando el estado de la tarea en Redmine según avanza. Los commits y la PR **no llevan coautoría ni firma del agente**.

**Depende de:** F2c (workspace, mapeo de estados), F3 (cambio de estado de una tarea)

## Tareas

- [x] **F11-T01** ADR-009 y modelo — documentar la arquitectura (runner local aparte) y crear la lógica pura en `shared/agent/` (config, cola, transiciones) con tests. · ✔ 2077846
  - _Acepta:_ ADR-009 en `01-arquitectura.md`; tests de `sanitizeAgentConfig` y de las transiciones de la cola en verde.

- [x] **F11-T02** Runner local — `agent-runner/` (Node, `node:http`): escucha solo en `127.0.0.1`, token aleatorio al arrancar, CORS limitado al origen de la app, repo y comandos de verificación fijos en `agent-runner.config.json` (el cliente no manda rutas ni comandos); endpoints para encolar/cancelar y SSE de eventos. Script `pnpm agent:runner`. · ✔ b17e04a
  - _Depende:_ F11-T01
  - _Acepta:_ sin token responde 401; otro origen no recibe cabeceras CORS; el token solo se imprime una vez al arrancar y no sale en ningún log de peticiones.

- [x] **F11-T03** Flujo por tarea — rama `agent/<id>-<slug>`, `claude -p` (stream-json), verificación (`lint`, `typecheck`, `test`), `git push` y `gh pr create`. Sin `Co-Authored-By` ni "Generated with": se pasa `attribution` vacío al agente y se comprueba el `git log` antes de empujar.
  - _Depende:_ F11-T02
  - _Acepta:_ test con un `claude` falso recorre el flujo; un commit con coautoría se reescribe antes del push; árbol sucio se rechaza. · ✔ 2b46658
  - _Hecho:_ 2b46658. `agent-runner/executor.ts`: árbol limpio, rama `agent/<id>-<slug>` (con sufijo si existe), `claude -p --output-format stream-json --verbose` con `--settings` de atribución vacía y `permissionMode`/`allowedTools` de la config del runner, commits sin firma (si la hay se juntan en uno limpio con `reset --soft`), `verifyCommands`, `git push` y `gh pr create`, y vuelta a la rama base. Tests con comandos falsos (`tests/unit/agent-executor.test.ts`). Falta una vuelta real contra un repo de prueba.

- [~] **F11-T04** Store y composables — `app/stores/agent.ts` (config no secreta + cola en `localStorage`), `useAgentRunner` (HTTP/SSE) y `useAgentQueue`. El token del runner no va a `localStorage`.
  - _Depende:_ F11-T01
  - _Acepta:_ recargar conserva la cola; el token no aparece en el almacenamiento del navegador.
  - _Hecho:_ 08d6137. `stores/agent.ts` (config + cola en `redmine-client:agent`, log en memoria), `useAgentRunner` (HTTP + SSE por `fetch` con Last-Event-ID), `useAgentQueue` y `agent/QueueEngine.vue` en el layout (manda la siguiente cuando no hay nada en curso; una tarea "en curso" que el runner no tiene queda bloqueada). URL y token compartidos con la IA (`stores/ai.ts`); el token solo en memoria (comprobado en el e2e).

- [~] **F11-T05** Integraciones IA — `AgentIntegrationsDialog` (agente, URL del runner, token, rama base, mapeo de estados, "Probar conexión") y entrada en el menú de cuenta.
  - _Depende:_ F11-T04
  - _Acepta:_ funciona con teclado; "Probar conexión" informa éxito o motivo del fallo.
  - _Hecho:_ 08d6137. `agent/IntegrationsDialog.vue`, desde el menú de cuenta y desde `/agent`: URL (solo localhost), token, rama base y estados por fase; "Probar conexión" dice "Conectado" o el motivo (token no válido, runner sin arrancar).

- [~] **F11-T06** Página Cola de Agente — `/agent` con la lista (estado con icono + texto, log, enlace a la PR, iniciar/pausar/cancelar/reintentar), alta desde el menú de tarea y estado vacío con "Configurar agente". Entrada en la navegación.
  - _Depende:_ F11-T05
  - _Acepta:_ sin agente configurado se ve el botón que abre el modal; checklist de `02-diseno.md` pasada.
  - _Hecho:_ 08d6137. `/agent` con fase (icono + texto), rama, PR, log, subir/bajar, cancelar, reintentar, quitar y pausar/reanudar; "Cola de Agente" en la navegación ("Agente" en la tab bar) y "Añadir a la cola del agente" en el menú de tarea cuando hay agente. Falta la checklist de diseño.

- [x] **F11-T07** Estados en Redmine — al cambiar la fase de una tarea de la cola, la app aplica el estado mapeado con `useIssueChange` respetando `allowed_statuses`; si la transición no está permitida, avisa y sigue.
  - _Depende:_ F11-T04
  - _Acepta:_ test del mapeo fase → estado; una transición no permitida no rompe la cola. · ✔ 08d6137
  - _Hecho:_ 08d6137. `shared/agent/status.ts` (`statusForPhase`, `canApplyStatus` con `allowed_statuses`), con tests; `useAgentQueue.applyStatus` aplica con `useIssueChange` o avisa "Redmine no deja pasar…; la cola sigue".

- [x] **F11-T08** E2E y cierre — Playwright (1280 y 375 px) con un runner falso.
  - _Depende:_ F11-T06, F11-T07
  - _Acepta:_ sin agente → modal; con runner falso se ven los cambios de estado y el enlace a la PR. · ✔ 1739cb4
  - _Hecho:_ 1739cb4. `tests/e2e/agent.spec.ts` (1280 y 375): sin agente → "Configurar agente"; con un runner falso por `page.route`, token malo y bueno, encolar desde el menú de la lista, fases hasta "PR abierta" con su enlace y el log; el token no queda en el almacenamiento.

## Definición de hecho

Encolar una tarea pequeña hace que el agente cree la rama, pase las pruebas, abra la PR sin coautoría y deje la tarea en revisión en Redmine.
