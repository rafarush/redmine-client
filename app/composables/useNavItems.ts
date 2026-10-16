export interface NavItem {
  /** Etiqueta de la sidebar. */
  label: string
  /** Etiqueta corta para la tab bar: una palabra (HIG tab-bars.md). */
  short: string
  to: string
  icon: string
}

/**
 * Secciones de primer nivel. La sidebar (ancho regular) y la tab bar (compacto)
 * muestran las mismas, para que las funciones no cambien con el tamaño.
 */
export function useNavItems(): NavItem[] {
  return [
    { label: 'Workspace', short: 'Inicio', to: '/', icon: 'lucide:layout-dashboard' },
    { label: 'Tareas', short: 'Tareas', to: '/issues', icon: 'lucide:ticket' },
    { label: 'Tiempo', short: 'Tiempo', to: '/time', icon: 'lucide:timer' },
    { label: 'Proyectos', short: 'Proyectos', to: '/projects', icon: 'lucide:folder-kanban' },
    { label: 'Wiki', short: 'Wiki', to: '/wiki', icon: 'lucide:book-open' },
    { label: 'Cola de Agente', short: 'Agente', to: '/agent', icon: 'lucide:bot' },
  ]
}
