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
    { label: 'Mis tareas', short: 'Tareas', to: '/', icon: 'lucide:ticket' },
    { label: 'Tiempo', short: 'Tiempo', to: '/tiempo', icon: 'lucide:timer' },
    { label: 'Proyectos', short: 'Proyectos', to: '/proyectos', icon: 'lucide:folder-kanban' },
    { label: 'Wiki', short: 'Más', to: '/wiki', icon: 'lucide:book-open' },
  ]
}
