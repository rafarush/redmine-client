# Fixtures

Respuestas reales del Redmine local, capturadas para poder escribir tests sin levantar Docker.

## Regenerarlas

```sh
docker compose -f docker/compose.dev.yml up -d
pnpm seed
pnpm capture:fixtures
```

El script usa la clave del usuario **desarrollador**, no la del admin: así las respuestas reflejan lo que ve un usuario normal, que es el caso que importa para los permisos.

Los ids y las fechas vienen del seed, que es determinista salvo en las fechas de las entradas de tiempo (relativas a hoy).

## Qué hay

Un archivo por endpoint, con el nombre de la ruta y los parámetros relevantes. `index.json` lista qué ruta corresponde a cada archivo; el mock (`tests/mocks/redmine.ts`) lo lee para responder.
