# F12 · IA para escribir: mejorar textos y autocompletar

**Objetivo:** ayudar a escribir donde hay textos largos (descripciones, wiki, noticias, comentarios): mejorar lo seleccionado con un tono o un prompt propio, sugerir cómo seguir mientras se escribe y proponer los campos de una tarea nueva. Todo con un motor de IA configurable y sin que ningún secreto llegue al navegador.

**Depende de:** F3 (editores de texto), F11-T02 (runner local)

## Decisiones

- Motor configurable en Ajustes (ADR-010): **API de Anthropic** a través del servidor (la clave en la sesión sellada o en `NUXT_ANTHROPIC_API_KEY`) o **runner local** (`claude -p` con la cuenta de Claude Code de la persona).
- Los prompts se construyen con `shared/ai/prompts.ts` en el lado que llama al modelo (Nitro o runner); el navegador manda la tarea y el texto, no el prompt de sistema.
- Modelo por defecto `claude-opus-5-5`, elegible por separado para "Mejorar" y "Autocompletar".
- Tonos: cuatro de fábrica (se pueden ocultar, no borrar) y los que añada la persona (nombre + prompt). En `localStorage`, sin secretos.

## Tareas

- [ ] **F12-T01** Lógica pura — `shared/ai/`: contrato (Zod), tonos, prompts, reemplazo de selección, texto fantasma y mapeo de sugerencias a ids.
  - _Acepta:_ tests unitarios.

- [ ] **F12-T02** Motores — Nitro `server/api/ai/{status,key,complete}` con `@anthropic-ai/sdk` y `POST /ai/complete` en el runner con `claude -p`.
  - _Depende:_ F12-T01
  - _Acepta:_ la clave nunca sale en ninguna respuesta; sin token el runner responde 401; probado contra el motor real.

- [ ] **F12-T03** Ajustes de IA — pestaña "Inteligencia artificial" en Ajustes: motor, clave o runner, "Probar conexión", modelos, interruptores y tonos editables.
  - _Depende:_ F12-T02
  - _Acepta:_ crear un tono "Tono académico" y verlo en el popover; funciona con teclado.

- [ ] **F12-T04** Mejorar con IA — botón ✦ (estrella de cuatro puntas) en los editores de texto largo: tono o prompt propio, antes/después, "Reemplazar" con Deshacer, cancelable.
  - _Depende:_ F12-T03
  - _Acepta:_ sin selección explica qué hacer; sin motor ofrece "Configurar IA".

- [ ] **F12-T05** Texto fantasma — sugerencia en gris al final del texto tras una pausa; Tab acepta, Esc o seguir escribiendo descarta. Con interruptor.
  - _Depende:_ F12-T03
  - _Acepta:_ desactivado no hace ninguna petición; una petición vieja nunca pisa a la nueva.

- [ ] **F12-T06** Sugerir campos — en "Nueva tarea", ✦ "Sugerir con IA" propone tipo, prioridad, descripción y estimación del proyecto; se aplica campo a campo y nunca pisa lo escrito. Con interruptor.
  - _Depende:_ F12-T03
  - _Acepta:_ solo propone valores que existen en el proyecto.

- [ ] **F12-T07** e2e — mejorar y reemplazar, tono personalizado y texto fantasma con el motor simulado (1280 y 375).
  - _Depende:_ F12-T04, F12-T05, F12-T06

## Definición de hecho

Seleccionar un párrafo de una descripción, mejorarlo con "Tono académico" y reemplazarlo lleva menos de 10 s y se puede deshacer; ninguna clave ni token aparece en el almacenamiento del navegador ni en las respuestas.
