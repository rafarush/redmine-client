import { RedmineClient } from '../../shared/redmine/client'
import { ProxyTransport } from '../../shared/redmine/proxy-transport'
import { isTauri } from '../../shared/redmine/transport'

/**
 * Elige el transport según dónde corre la app y deja el cliente disponible (F1-T03).
 * Nada fuera de aquí necesita saber si estamos en web o en escritorio.
 */
export default defineNuxtPlugin(() => {
  if (isTauri()) {
    // TauriTransport llega en F8-T04; hasta entonces el empaquetado usa el proxy.
    console.warn('Tauri detectado, pero TauriTransport aún no existe (F8-T04). Se usa el proxy.')
  }

  const client = new RedmineClient(new ProxyTransport())

  return { provide: { redmine: client } }
})
