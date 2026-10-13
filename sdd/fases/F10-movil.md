# F10 · Móvil (futuro)

**Objetivo:** la app en iOS y Android con Tauri 2 móvil, adaptada al uso con una mano. Los casos principales en el teléfono son ver mis tareas, comentar, cambiar estado y registrar tiempo.

**Depende de:** F8, F9

## Tareas

- [ ] **F10-T01** Spike de viabilidad — `pnpm tauri android init` / `ios init`; probar `plugin-http`, llavero (Keystore / Keychain) y el rendimiento de la lista virtualizada en un dispositivo de gama media. Decidir si se sigue con Tauri móvil o se evalúa Capacitor. El resultado se documenta como ADR-008 en `01-arquitectura.md`.
  - _Acepta:_ ADR escrito con mediciones (arranque, scroll, memoria).

- [ ] **F10-T02** Navegación compacta — tab bar inferior (Tareas, Tiempo, Proyectos, Más) con iconos rellenos y etiquetas de una palabra; las pestañas solo navegan, no ejecutan acciones (`tab-bars.md`). Respetar safe areas.
  - _Depende:_ F10-T01
  - _Acepta:_ ninguna pestaña se oculta ni se deshabilita según el contexto.

- [ ] **F10-T03** Sheets en vez de popovers — en táctil, el popover de tiempo y los tokens de filtro se presentan como sheet inferior con detent medio y grabber, cerrable deslizando (`sheets.md`). Mismo componente, presentación según `pointer: coarse`.
  - _Depende:_ F10-T02
  - _Acepta:_ registrar tiempo con una mano: botón al alcance del pulgar y teclado numérico para la duración.

- [ ] **F10-T04** Gestos en filas — deslizar a la izquierda: "Registrar tiempo"; a la derecha: cambiar estado. Siempre con alternativa visible (menú "…").
  - _Depende:_ F10-T02
  - _Acepta:_ los gestos funcionan con VoiceOver/TalkBack mediante acciones personalizadas.

- [ ] **F10-T05** Tamaños y texto — 17 pt de base, objetivos de 44×44, Dynamic Type / escala de fuente del sistema respetada hasta los tamaños de accesibilidad sin perder funciones.
  - _Depende:_ F10-T02
  - _Acepta:_ capturas con el tamaño de texto máximo en `docs/design/`.

- [ ] **F10-T06** Publicación — firma, iconos y capturas para App Store y Google Play; CI de builds móviles.
  - _Depende:_ F10-T03, F10-T04, F10-T05
  - _Acepta:_ build de TestFlight y de prueba interna en Play instalables.

## Definición de hecho

Las métricas de `00-vision.md` para registrar tiempo se cumplen también en el teléfono, con una mano.
