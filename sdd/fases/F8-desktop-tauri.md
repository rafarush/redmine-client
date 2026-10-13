# F8 · App desktop con Tauri 2

**Objetivo:** la misma app como aplicación de escritorio para Windows y macOS, que habla directo con Redmine y se siente nativa (menú, atajos, ventana).

**Depende de:** F1 (recomendado tras F4)

## Tareas

- [ ] **F8-T01** Toolchain — instalar Rust (`rustup`, toolchain estable), en Windows las *Build Tools* de Visual Studio (C++) y WebView2 (viene con Windows 11). Documentar en `README.md › Desktop`.
  - _Acepta:_ `cargo --version` y `rustc --version` responden; `pnpm tauri info` no muestra errores.

- [ ] **F8-T02** Inicializar Tauri — `pnpm add -D @tauri-apps/cli` y `pnpm tauri init` con `frontendDist: ../.output/public`, `devUrl: http://localhost:3000`, `beforeBuildCommand: pnpm generate`. Scripts `tauri:dev` y `tauri:build`. Identificador `com.<empresa>.redmineclient`. Icono de app según `app-icons.md` (forma simple, sin texto, variantes claro/oscuro).
  - _Depende:_ F8-T01
  - _Acepta:_ `pnpm tauri:dev` abre la ventana con la app; `pnpm generate` no depende de rutas de servidor.

- [ ] **F8-T03** Plugin HTTP con scope dinámico — `@tauri-apps/plugin-http`; el scope permitido se limita al host que el usuario configuró (al conectar, el frontend pide al backend de Rust que registre el host; nada de `*`).
  - _Depende:_ F8-T02
  - _Acepta:_ una petición a otro host desde la consola de la webview es rechazada.

- [ ] **F8-T04** TauriTransport — implementación de `RedmineTransport` con `plugin-http`, incluyendo cuerpos binarios para `/uploads.json`. Pasa el mismo test de contrato que ProxyTransport (F1-T03).
  - _Depende:_ F8-T03, F1-T03
  - _Acepta:_ test de contrato en verde con ambos transports.

- [ ] **F8-T05** Credenciales en el llavero — guardar `{ url, apiKey }` en el llavero del SO (Credential Manager / Keychain) con un plugin de keyring; `stronghold` como alternativa si la plataforma no lo soporta. La pantalla de conexión (F1-T04) usa esta vía cuando `isTauri()`.
  - _Depende:_ F8-T04
  - _Acepta:_ la key no aparece en ningún archivo de la carpeta de datos de la app; desconectar la borra del llavero.

- [ ] **F8-T06** Menú nativo y atajos — menú con todos los comandos de la app (Archivo: Nueva tarea, Importar…; Edición: estándar; Ver: Mostrar sidebar, Ir a Tareas / Tiempo / Proyectos; Tarea: Registrar tiempo, Iniciar temporizador, Abrir en Redmine; Ventana; Ayuda). Atajos estándar respetados y los propios documentados (`keyboards.md`, `the-menu-bar.md`). En macOS, Preferencias en el menú de la app (`⌘,`).
  - _Depende:_ F8-T02
  - _Acepta:_ cada acción de toolbar existe en el menú; los atajos del menú y los de la webview no se disparan dos veces.

- [ ] **F8-T07** Ventana — tamaño y posición recordados, tamaño mínimo que no rompe el layout (≥ 720×480), estilo de barra de título nativo; en macOS barra con `titleBarStyle` transparente solo si la toolbar respeta la zona de los semáforos.
  - _Depende:_ F8-T02
  - _Acepta:_ redimensionar de compacto a regular cambia sidebar ↔ tab bar sin perder estado.

- [ ] **F8-T08** Extras de escritorio — temporizador activo en el icono de bandeja/menu bar con detener rápido; notificación nativa opcional al terminar una importación larga (pidiendo permiso en contexto, `privacy.md`).
  - _Depende:_ F8-T06, F4-T05
  - _Acepta:_ desactivar notificaciones en Preferencias las deja de enviar.

- [ ] **F8-T09** Actualizador y empaquetado — `tauri-plugin-updater` con firma; CI que construye `.msi` (Windows) y `.dmg` (macOS) en GitHub Actions y publica en Releases.
  - _Depende:_ F8-T02, F0-T03
  - _Acepta:_ instalar la versión N y publicar la N+1 ofrece la actualización al abrir.

## Definición de hecho

Instaladores de Windows y macOS que se conectan a un Redmine de red interna sin servidor web intermedio, guardan la key en el llavero y exponen todo en el menú nativo.
