import type { ImportCatalog } from '../../shared/import/model'

/** Catálogo de un proyecto de prueba para los tests de importación (F5). */
export const catalog: ImportCatalog = {
  project: { id: 1, identifier: 'portal-web', name: 'Portal Web' },
  trackers: [{ id: 1, name: 'Errores' }, { id: 2, name: 'Tareas' }],
  statuses: [{ id: 1, name: 'Nueva' }, { id: 2, name: 'En curso' }],
  priorities: [{ id: 4, name: 'Normal' }, { id: 5, name: 'Urgente' }],
  members: [{ id: 5, name: 'Dani Desarrollo' }],
  versions: [{ id: 2, name: 'Sprint 1' }],
  categories: [{ id: 3, name: 'Gestión' }],
  customFields: [{ id: 7, name: 'Cliente', options: ['Acme', 'Beta'] }, { id: 8, name: 'Notas' }],
}
