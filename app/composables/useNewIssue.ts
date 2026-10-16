/**
 * Crear una tarea. Hasta que llegue el formulario propio (F3-T07) abre el de
 * Redmine; el botón de la toolbar y el atajo `newIssue` hacen lo mismo.
 */
export function useNewIssue() {
  const session = useSessionStore()

  const allowed = computed(() => session.can('add_issues'))

  function open(): void {
    if (!allowed.value) return
    window.open(`${session.url.replace(/\/$/, '')}/issues/new`, '_blank', 'noopener')
  }

  return { allowed, open }
}
