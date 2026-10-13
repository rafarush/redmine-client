# Docker

## Redmine local para desarrollo

Levanta un Redmine 6 con PostgreSQL y lo llena con datos de prueba.

```sh
docker compose -f docker/compose.dev.yml up -d
pnpm seed
```

La primera vez tarda unos minutos: descarga las imágenes y Redmine migra la base de datos. El seed espera a que responda.

Cuando termine, Redmine está en **http://localhost:3080** y el script imprime una tabla con las claves de API de cada usuario. Pégalas en la pantalla de conexión de la app.

| Usuario | Contraseña | Rol en los proyectos | Para qué sirve |
|---|---|---|---|
| `admin` | `admin` | — (administrador) | Ve y puede todo: útil para comparar |
| `desarrollador` | `Prueba.1234` | Desarrollador | El caso normal: puede registrar tiempo y editar tareas |
| `cliente` | `Prueba.1234` | Cliente | **No tiene `log_time`**: con él la app no debe mostrar ningún control de registrar tiempo |

El rol `Cliente` lo crea el seed, porque el `Reporter` que trae Redmine por defecto sí puede registrar tiempo y no serviría para probar el ocultado por permisos.

### Qué crea el seed

- Habilita la API REST (`Administración → Ajustes → API`) y pone el formato de texto en CommonMark.
- 3 proyectos: **Portal Web**, su subproyecto **Portal Web · Móvil** y **Soporte Interno**, con los módulos de tareas, tiempo, wiki, noticias y archivos.
- 3 usuarios con los roles de la tabla.
- 42 tareas repartidas entre los proyectos, con estados abiertos y cerrados, prioridades, asignaciones, estimaciones y avance.
- 2 versiones en Portal Web, con tareas asignadas a cada una.
- 12 entradas de tiempo de los últimos días.
- Una página de wiki en Portal Web.

Volver a ejecutar `pnpm seed` no duplica nada: comprueba qué existe antes de crearlo.

### Empezar de cero

```sh
docker compose -f docker/compose.dev.yml down -v
docker compose -f docker/compose.dev.yml up -d
pnpm seed
```

## Despliegue de la versión web

```sh
cp .env.example .env   # y edita NUXT_SESSION_PASSWORD y NUXT_REDMINE_ALLOWED_HOSTS
docker compose -f docker/compose.yml up -d --build
```

Queda escuchando en el puerto 8080. Ponlo detrás del proxy inverso de la empresa con HTTPS: la cookie de sesión se marca `Secure` en producción.
