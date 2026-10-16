/**
 * Crear una tarea: abre el diálogo "Nueva tarea" (F3-T07), que vive una sola vez
 * en el layout. El botón de la toolbar y el atajo `newIssue` hacen lo mismo.
 */
export function useNewIssue() {
  const session = useSessionStore()
  const isOpen = useState('new-issue-open', () => false)

  const allowed = computed(() => session.can('add_issues'))

  function open(): void {
    if (!allowed.value) return
    isOpen.value = true
  }

  return { allowed, isOpen, open }
}
