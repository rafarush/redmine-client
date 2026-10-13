# 00 · Visión

## Problema

Redmine cubre bien la gestión de tareas, pero el trabajo diario cuesta más de lo necesario:

- Registrar tiempo obliga a abrir otra vista, llenar un formulario largo y volver.
- Los filtros se arman con selects y operadores pensados para la base de datos, no para las personas.
- Crear muchas tareas parecidas (un sprint, una lista de un cliente) significa repetir el mismo formulario una y otra vez.
- La interfaz muestra acciones que el usuario no puede ejecutar, y se entera recién al recibir el error.

## Usuarios

- **Desarrolladores y soporte**: abren la app varias veces al día, filtran lo suyo, actualizan estados, registran horas.
- **Líderes y PM**: crean tareas en lote, revisan versiones y avance, miran las horas del equipo.

Todos ya usan Redmine. No hay que enseñarles qué es un tracker, sino quitarles pasos.

## Qué es y qué no es

- **Es** un cliente de la API de Redmine: no tiene base de datos propia. Redmine sigue siendo la fuente de verdad.
- **Es** para un usuario con su API key. Ve y hace exactamente lo que Redmine le permite.
- **No es** una consola de administración de Redmine (usuarios, roles, workflows, campos personalizados se siguen gestionando en Redmine).

## Principios (HIG `design-principles.md`)

| Principio | Cómo se aplica aquí |
|---|---|
| Purpose | Cada pantalla tiene un solo trabajo. La lista de tareas es el centro; todo lo frecuente pasa ahí. |
| Agency | Deshacer en vez de confirmar; borradores que no se pierden al cerrar un diálogo. |
| Familiarity | Vocabulario de Redmine (tarea, tracker, versión) y patrones de la plataforma (sidebar, toolbar, popover, menú). |
| Simplicity | Se oculta lo que el usuario no puede hacer. Los campos poco usados quedan en "Más campos". |
| Responsibility | La API key nunca queda en el navegador en texto plano; se explica para qué se pide. |

## Métricas de éxito

| Métrica | Objetivo |
|---|---|
| Registrar tiempo en una tarea visible | ≤ 5 s y ≤ 3 interacciones (abrir, escribir duración, Enter) |
| Cambiar un filtro | Sin recarga de página; resultado en < 1 s con caché |
| Crear 50 tareas desde Excel | < 2 min incluyendo revisión del preview |
| Primer uso | De abrir la app a ver mis tareas: un solo formulario (URL + API key) |
| Acciones no permitidas visibles | 0 |
