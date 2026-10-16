# SDD: Redmine Client

Plan de desarrollo guiado por especificación. Lo puede ejecutar una persona o un agente, tarea por tarea.

## Documentos

| Archivo | Qué contiene |
|---|---|
| `00-vision.md` | Problema, usuarios, principios y métricas de éxito |
| `01-arquitectura.md` | Decisiones (ADR) con pros y contras, flujo de red, seguridad, caché |
| `02-diseno.md` | Sistema de diseño: tokens, tipografía, componentes, movimiento, con citas a la HIG |
| `03-api-redmine.md` | Endpoints de Redmine que usa la app y modelo de permisos |
| `fases/F*.md` | Una fase por archivo, con sus tareas |

## Fases

| Fase | Objetivo | Depende de |
|---|---|---|
| [F0](fases/F0-fundaciones.md) ✔ | Fundaciones: tooling, CI, tokens, layout, Redmine local | — |
| [F1](fases/F1-setup-sesion-permisos.md) | Conexión, sesión, transport y permisos | F0 |
| [F2](fases/F2-tareas-filtros.md) | Lista de tareas y filtros como frase | F1 |
| [F2b](fases/F2b-rediseno-visual.md) | Rediseño visual completo (estilo Apple) | F2-T08 |
| [F2c](fases/F2c-workspace.md) | Workspace: boards de mis tareas con acciones rápidas | F2b |
| [F2d](fases/F2d-kanban.md) | Kanban por estado, sprint y estado×sprint | F2c |
| [F3](fases/F3-detalle-edicion-creacion.md) | Detalle, edición y creación de tareas | F2 |
| [F4](fases/F4-tiempo.md) | Registrar tiempo en popover y timesheet | F2 (F3 para el popover en el detalle) |
| [F5](fases/F5-importacion-excel.md) | Plantilla Excel e importación en lote | F3 |
| [F6](fases/F6-proyectos-versiones.md) | Proyectos, versiones y miembros | F1 |
| [F7](fases/F7-wiki-noticias-archivos.md) | Wiki, noticias y archivos | F1 |
| [F8](fases/F8-desktop-tauri.md) | App desktop con Tauri 2 | F1 (mejor tras F4) |
| [F9](fases/F9-pulido-accesibilidad.md) | Auditoría de diseño, accesibilidad y rendimiento | F2–F7 |
| [F10](fases/F10-movil.md) | Móvil (iOS/Android) con Tauri | F8, F9 |

| [F11](fases/F11-cola-agente.md) | Cola de Agente e Integraciones IA | F2c, F3 |
| [F12](fases/F12-ia-textos.md) | IA para escribir: mejorar textos y autocompletar | F3, F11-T02 |

F6, F7 y F8 pueden avanzar en paralelo a F2–F5 una vez cerrada F1.

F2b–F2d salen de la crítica de diseño del 2026-10-15 y van antes que el resto de F2: F2-T09 y F2-T10 se retoman al cerrar F2b.

## Formato de una tarea

```md
- [ ] **F2-T03** Título corto — qué hay que hacer.
  - _Depende:_ F2-T01, F2-T02
  - _Acepta:_ criterios verificables (comportamiento, test, captura).
```

Estados: `[ ]` pendiente · `[~]` en curso · `[x]` hecha · `[-]` descartada (con motivo).

## Flujo

1. Elige la primera tarea `[ ]` de la fase activa cuyas dependencias estén en `[x]`.
2. Márcala `[~]` (si trabajan varios, añade tu nombre: `[~] @nombre`).
3. Implementa y cumple **todos** los criterios de _Acepta_. La lógica pura lleva test unitario.
4. Haz commit con el id: `F2-T03: barra de filtros como frase`.
5. Márcala `[x]` y añade ` · ✔ <hash>`.
6. Una fase está cerrada cuando todas sus tareas están `[x]` o `[-]` y se cumple su **Definición de hecho**.

## Reglas

- No empieces una fase sin que sus dependencias estén cerradas.
- Si descubres trabajo nuevo, añádelo como tarea en la fase que corresponda (id siguiente libre) en vez de hacerlo en silencio.
- Si cambias una decisión de arquitectura o diseño, actualiza `01-arquitectura.md` o `02-diseno.md` en el mismo commit.
- Toda pantalla nueva pasa por la checklist de `02-diseno.md › Checklist por pantalla` antes de marcarse `[x]`.
