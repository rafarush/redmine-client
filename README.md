# Redmine Client

Cliente web de [Redmine](https://www.redmine.org/) con una experiencia más simple que la original. Usa la REST API de Redmine 5.x/6.x con tu API key y solo te muestra lo que tu usuario puede hacer.

## 1. Qué es?

Redmine cubre bien la gestión de tareas, pero el día a día cuesta más de lo necesario: registrar tiempo obliga a abrir otra vista, los filtros se arman con selects y operadores pensados para la base de datos, y la interfaz muestra acciones que luego fallan por falta de permisos.

Redmine Client es una capa de interfaz encima de tu Redmine:

- **No tiene base de datos propia.** Redmine sigue siendo la fuente de verdad.
- **Es para un usuario con su API key.** Ve y hace exactamente lo que Redmine le permite.
- **No es una consola de administración.** Usuarios, roles y workflows se siguen gestionando en Redmine.

Se despliega como SPA con un pequeño proxy ([Nuxt 4](https://nuxt.com/) + Nitro). Una versión de escritorio con Tauri 2 está planificada (fase F8) y la móvil, después.

## 2. Qué hace?

- **Conexión simple**: configuras la URL de tu Redmine y tu API key una sola vez. En web la clave vive en una cookie de sesión sellada, nunca en `localStorage`.
- **Permisos reales**: cada acción se protege con el permiso de Redmine correspondiente; lo que no puedes hacer se oculta (o se deshabilita con el motivo).
- **Filtros como frase**: *Tareas asignadas a mí en Abierta de Proyecto X*, editable pieza a pieza, con filtros guardados.
- **Lista de tareas** virtualizada y con columnas configurables, además de **Kanban** por estado, por sprint o estado × sprint.
- **Workspace** con boards de "mis tareas" y acciones rápidas.
- **Detalle, edición y creación** de tareas sin salir de la lista (diálogos y popovers).
- **Registro de tiempo** en un popover, con atajos de teclado, temporizador activo y hoja de horas.
- **Importación en lote desde Excel**: descarga una plantilla, rellénala y crea muchas tareas a la vez, con validación fila por fila.
- **Proyectos, versiones y miembros**, **wiki**, **noticias** y **archivos**.
- **IA para escribir** (opcional): mejorar textos con tonos, autocompletar y proponer campos de una tarea nueva, con la API de Anthropic o con un runner local.
- **Cola de agente** (opcional): encola tareas de Redmine y un runner local con Claude Code las implementa en una rama propia, con pruebas y PR.
- Temas claro/oscuro, accesible por teclado, en español.

> El progreso por fase está en [`sdd/README.md`](sdd/README.md).

## 3. Cómo usarlo

### Requisitos

- Una instancia de Redmine 5.x o 6.x con la **API REST habilitada** (`Administración → Ajustes → API`).
- Tu **API key** de Redmine (`Mi cuenta → Clave de acceso de la API`).
- Para correrlo en local: Node.js 22 y [pnpm](https://pnpm.io/) 10. Para el despliegue con contenedor: Docker.

### Variables de entorno

Copia `.env.example` a `.env` y edítalo. **Nunca subas `.env` al repositorio** (ya está en `.gitignore`).

| Variable | Para qué sirve |
|---|---|
| `NUXT_SESSION_PASSWORD` | Clave para sellar la cookie de sesión, mínimo 32 caracteres. Genera una con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `NUXT_REDMINE_ALLOWED_HOSTS` | Hosts de Redmine a los que el proxy puede llamar, separados por coma (protege contra SSRF). Ejemplo: `redmine.miempresa.com`. |
| `NUXT_ANTHROPIC_API_KEY` | Opcional. Clave de la API de Anthropic para todos los usuarios. Si no se pone, cada persona guarda la suya en Ajustes. |

### Desplegado (servidor propio con Docker)

```sh
cp .env.example .env    # y edita NUXT_SESSION_PASSWORD y NUXT_REDMINE_ALLOWED_HOSTS
docker compose -f docker/compose.yml up -d --build
```

La app queda escuchando en el puerto **8080**. Ponla detrás de un proxy inverso con **HTTPS** (la cookie de sesión se marca `Secure` en producción) y abre esa URL. En la pantalla de conexión escribe la URL de tu Redmine (debe estar en `NUXT_REDMINE_ALLOWED_HOSTS`) y tu API key.

Sin Docker, también puedes construirla y ejecutar el servidor Nitro:

```sh
pnpm install
pnpm build
node .output/server/index.mjs   # puerto 3000 (o PORT)
```

(con las variables de entorno definidas en el entorno del proceso).

### En local, en tu computadora

```sh
cp .env.example .env     # y edita las variables
pnpm install
pnpm dev                 # http://localhost:3000
```

Si no tienes un Redmine a mano, levanta uno de prueba con datos de ejemplo:

```sh
docker compose -f docker/compose.dev.yml up -d   # Redmine local en http://localhost:3080
pnpm seed                                        # crea proyectos, tareas y usuarios; imprime sus API keys
```

Añade `localhost:3080` a `NUXT_REDMINE_ALLOWED_HOSTS`, abre <http://localhost:3000> y conecta con `http://localhost:3080` y una de las claves que imprimió el seed. Los usuarios de prueba y el detalle del seed están en [`docker/README.md`](docker/README.md). Son credenciales de **desarrollo local**, no las uses en un Redmine real.

### Runner del agente (opcional)

```sh
cp agent-runner.config.example.json agent-runner.config.json   # ajusta repoPath
pnpm agent:runner
```

Requiere [Claude Code](https://claude.com/claude-code) y `gh` instalados. El runner escucha solo en `127.0.0.1` y muestra un token al arrancar, que se pega en *Integraciones IA* dentro de la app.

### Comandos útiles

| Comando | Qué hace |
|---|---|
| `pnpm lint` / `pnpm lint:fix` | ESLint y formato |
| `pnpm typecheck` | Comprobación de tipos |
| `pnpm test` | Tests unitarios (Vitest) |
| `pnpm test:e2e` | Tests end-to-end (Playwright, 1280 y 375 px) |
| `pnpm check:contrast` | Contrastes de la paleta en los 4 modos |
| `pnpm build` | SPA + servidor Nitro (`.output`) |

## Documentación

- [`CLAUDE.md`](CLAUDE.md): guía rápida para agentes y desarrolladores (stack, arquitectura, convenciones).
- [`sdd/`](sdd/README.md): visión, arquitectura, diseño, API y plan por fases con tareas.
