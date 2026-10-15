---
target: interfaz completa (lista, shell, filtros, Ctrl+K)
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:D:\\Rafa\\Coding\\VscodeProjects\\redmine-client\\app\\pages\\index.vue"
target_fingerprint: "sha256:06571cda0751ae279e06bf4517c75f26c42d7e679d1aa499ec8b7ebfa2c87862"
target_path: "D:\\Rafa\\Coding\\VscodeProjects\\redmine-client\\app\\pages\\index.vue"
timestamp: 2026-10-15T23-37-55Z
slug: app-pages-index-vue
---
# Crítica: interfaz actual (lista de tareas, shell, filtros, Ctrl+K)

Method: dual-agent (A: design review · B: detector + contraste). Sin navegador (modo plan).

| # | Heurística | Nota | Problema |
|---|---|---|---|
| 1 | Estado del sistema | 3 | Cabeceras ordenables sin affordance hasta ordenar |
| 2 | Lenguaje del usuario | 3 | Placeholder.vue:21 muestra "fase F4" |
| 3 | Control y libertad | 2 | Borrar filtro guardado sin deshacer (Sidebar.vue:96) |
| 4 | Consistencia | 2 | Enter en fila = "pronto" vs Ctrl+K abre Redmine; velos distintos |
| 5 | Prevención de errores | 3 | <Can> y validación correctos |
| 6 | Reconocer, no recordar | 2 | Acciones de fila opacity-0 hasta hover |
| 7 | Flexibilidad | 3 | J/K, /, Ctrl+K, ?; faltan T y N |
| 8 | Estética y minimalismo | 2 | Tres franjas de cromo + tabla con línea en cada fila |
| 9 | Recuperarse de errores | 3 | Errores con causa y reintentar |
| 10 | Ayuda | 2 | Solo hoja de atajos |
| **Total** | | **25/40** | Aceptable |

## Especificidad
Aspecto SaaS genérico (Linear/shadcn): gris neutro, hairlines, chips en píldora, shadow-lg. surface vs raised ≈1,05:1; casi todo a 13 px; sin título. La frase de filtros de 02-diseno.md se pinta como chips "Estado: Abierta" (FilterToken.vue:87). Detector: 0 hallazgos en 25 .vue; check:contrast 40/40 pares OK.

## Problemas prioritarios
- [P0] Pantalla principal sin jerarquía ni foco; único Ruby es "Nueva tarea" deshabilitado. Fix: un toolbar con título grande, frase inline, sin líneas por fila.
- [P1] Ruby fuera de regla (AccountMenu.vue:23, TabBar.vue:18, connect.vue:84); ShortcutsSheet.vue:31 usa bg-content/30 (aclara en oscuro). Fix: token --scrim, Ruby solo primaria+foco.
- [P1] Frase de filtros convertida en chips. Fix: texto corrido con palabras de unión secundarias, valores como botones inline.
- [P2] Hover, seleccionado y elevado iguales (IssueTable.vue:416). Fix: --fill-hover y --fill-selected.
- [P2] Callejones sin salida: Enter "pronto", borrado sin deshacer, placeholders con jerga de fases.

## Personas
- Alex: Enter inútil, sin T/N, orden invisible, pista Ctrl+K oculta en compacto (Toolbar.vue:33).
- Sam: botones invisibles tabulables en cada fila dentro de role=grid; "Nueva tarea" se explica solo con title; botón dentro de listbox en la paleta.

## Menores
0 h como "0,0"; mismo icono para todo estado abierto; HEADER_HEIGHT=37 fijo; SaveFilter.vue:29 reutiliza data-filter-add; toasts arriba.

## Preguntas
- ¿Por qué la pantalla principal no funciona como la paleta: una superficie, cero cromo?
- ¿Dónde vive en pantalla el momento memorable (horas que suben)?
- Con el workspace, ¿sigue siendo "Tareas" la sección principal?
