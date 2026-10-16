import type { IssueDraft } from '../../shared/redmine/new-issue'

/**
 * Crear una tarea: abre el diálogo "Nueva tarea" (F3-T07), que vive una sola vez
 * en el layout. El botón de la toolbar y el atajo `newIssue` hacen lo mismo;
 * "Duplicar" (F3-T08) lo abre con un borrador ya relleno.
 */
export function useNewIssue() {
  const session = useSessionStore()
  const isOpen = useState('new-issue-open', () => false)
  /** Borrador con que abrir la próxima vez (lo consume el diálogo). */
  const prefill = useState<IssueDraft | null>('new-issue-prefill', () => null)

  const allowed = computed(() => session.can('add_issues'))

  function open(): void {
    if (!allowed.value) return
    isOpen.value = true
  }

  function openWith(draft: IssueDraft): void {
    if (!allowed.value) return
    prefill.value = draft
    isOpen.value = true
  }

  return { allowed, isOpen, prefill, open, openWith }
}
