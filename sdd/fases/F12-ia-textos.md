# F12 · IA para escribir: mejorar textos y autocompletar

**Objetivo:** ayudar a escribir donde hay textos largos (descripciones, wiki, noticias, comentarios): mejorar lo seleccionado con un tono o un prompt propio, sugerir cómo seguir mientras se escribe y proponer los campos de una tarea nueva. Todo con un motor de IA configurable y sin que ningún secreto llegue al navegador.

**Depende de:** F3 (editores de texto), F11-T02 (runner local)

## Decisiones

- Motor configurable en Ajustes (ADR-010): **API de Anthropic** a través del servidor (la clave en la sesión sellada o en `NUXT_ANTHROPIC_API_KEY`) o **runner local** (`claude -p` con la cuenta de Claude Code de la persona).
- Los prompts se construyen con `shared/ai/prompts.ts` en el lado que llama al modelo (Nitro o runner); el navegador manda la tarea y el texto, no el prompt de sistema.
- Modelo por defecto `claude-opus-5-5`, elegible por separado para "Mejorar" y "Autocompletar".
- Tonos: cuatro de fábrica (se pueden ocultar, no borrar) y los que añada la persona (nombre + prompt). En `localStorage`, sin secretos.

## Tareas

- [x] **F12-T01** Lógica pura — `shared/ai/`: contrato (Zod), tonos, prompts, reemplazo de selección, texto fantasma y mapeo de sugerencias a ids.
  - _Acepta:_ tests unitarios. · ✔ f7913c4
  - _Hecho:_ f7913c4. `shared/ai/contract.ts` (Zod, modelos), `prompts.ts` (texto entre etiquetas tratado como dato, `</etiqueta>` escapada; limpieza del resultado; lectura de JSON aunque venga con texto), `tones.ts` y `editing.ts` (reemplazo de selección, cuándo pedir texto fantasma y cómo limpiarlo, mapeo de propuesta a ids). Tests en `tests/unit/ai.test.ts`.

- [~] **F12-T02** Motores — Nitro `server/api/ai/{status,key,complete}` con `@anthropic-ai/sdk` y `POST /ai/complete` en el runner con `claude -p`.
  - _Depende:_ F12-T01
  - _Acepta:_ la clave nunca sale en ninguna respuesta; sin token el runner responde 401; probado contra el motor real.
  - _Hecho:_ dc86308. Nitro: `server/utils/ai.ts` + `/api/ai/{status,key,complete}` (clave en `secure.anthropicKey` o `NUXT_ANTHROPIC_API_KEY`; `fallbacks: "default"` con `server-side-fallback-2026-07-01` en Opus y Sonnet; `stop_reason: refusal` → 422; cancelación al cerrar la respuesta). Runner: `agent-runner/ai.ts` (`claude -p --tools "" --strict-mcp-config --no-session-persistence`, prompt por stdin, en `tmpdir()`), ruta `POST /ai/complete` con token. Probado contra Claude Code real (mejorar, continuar y proponer campos con Haiku, 6–9 s); el prompt de continuar se ajustó porque repetía el texto. Falta probar la API con una clave real.

- [~] **F12-T03** Ajustes de IA — pestaña "Inteligencia artificial" en Ajustes: motor, clave o runner, "Probar conexión", modelos, interruptores y tonos editables.
  - _Depende:_ F12-T02
  - _Acepta:_ crear un tono "Tono académico" y verlo en el popover; funciona con teclado.
  - _Hecho:_ 38377bf. `stores/ai.ts` (sin secretos; token del runner solo en memoria), `useAi` y la pestaña en `workspace/SettingsDialog.vue` (`settings/AiSection.vue`). Pendiente de verificar en el navegador (F12-T07).

- [~] **F12-T04** Mejorar con IA — botón ✦ (estrella de cuatro puntas) en los editores de texto largo: tono o prompt propio, antes/después, "Reemplazar" con Deshacer, cancelable.
  - _Depende:_ F12-T03
  - _Acepta:_ sin selección explica qué hacer; sin motor ofrece "Configurar IA".
  - _Hecho:_ ddf3771. `ai/ImproveButton.vue` (`lucide:sparkle`): sin selección ofrece "Mejorar todo el texto"; tonos visibles, prompt propio, Mejorando… cancelable, antes/después editable, "Reemplazar" con Deshacer, "Otro tono", "Repetir". En la descripción de la tarea (`RichTextEditor`), el editor de la wiki, el texto de las noticias, la caja de comentarios y la descripción de "Nueva tarea". Pendiente de verificar en el navegador.

- [~] **F12-T05** Texto fantasma — sugerencia en gris al final del texto tras una pausa; Tab acepta, Esc o seguir escribiendo descarta. Con interruptor.
  - _Depende:_ F12-T03
  - _Acepta:_ desactivado no hace ninguna petición; una petición vieja nunca pisa a la nueva.
  - _Hecho:_ ddf3771. `ai/GhostTextarea.vue` sustituye a los textarea de esos cinco campos: espejo que copia las medidas del textarea, pausa de 700 ms, solo con el cursor al final; Tab acepta y Esc solo descarta (no cierra el editor); cualquier cambio cancela la petición en curso y una respuesta vieja se tira. Pendiente de verificar en el navegador.

- [~] **F12-T06** Sugerir campos — en "Nueva tarea", ✦ "Sugerir con IA" propone tipo, prioridad, descripción y estimación del proyecto; se aplica campo a campo y nunca pisa lo escrito. Con interruptor.
  - _Depende:_ F12-T03
  - _Acepta:_ solo propone valores que existen en el proyecto.
  - _Hecho:_ dce76ba. En `NewIssueDialog.vue`: propuesta con "Aplicar" por campo y "Aplicar todo", que no cambia descripción ni estimación ya escritas (uno a uno dice "Reemplazar"). Valores mapeados con `resolveSuggestion`. Pendiente de verificar en el navegador.

- [ ] **F12-T07** e2e — mejorar y reemplazar, tono personalizado y texto fantasma con el motor simulado (1280 y 375).
  - _Depende:_ F12-T04, F12-T05, F12-T06

## Definición de hecho

Seleccionar un párrafo de una descripción, mejorarlo con "Tono académico" y reemplazarlo lleva menos de 10 s y se puede deshacer; ninguna clave ni token aparece en el almacenamiento del navegador ni en las respuestas.
