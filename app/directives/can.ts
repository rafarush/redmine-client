import type { Directive, DirectiveBinding } from 'vue'
import { useSessionStore } from '../stores/session'
import { DENIED_REASON } from '../utils/can'

/**
 * `v-can` para cuando no merece la pena envolver en `<Can>` (F1-T07).
 *
 *   <UiButton v-can="'add_issues'" ... />
 *   <UiButton v-can="{ permission: 'log_time', project: issue.project.id }" ... />
 *   <UiButton v-can.disabled="'log_time'" ... />
 *
 * Por defecto oculta el elemento. Con el modificador `.disabled` lo deja visible
 * y apagado, con el motivo en el tooltip nativo (sdd/02-diseno.md › Permisos).
 */
export type CanValue = string | { permission: string, project?: number }

function toCheck(value: CanValue): { permission: string, project?: number } {
  return typeof value === 'string' ? { permission: value } : value
}

function apply(el: HTMLElement, binding: DirectiveBinding<CanValue>): void {
  const { permission, project } = toCheck(binding.value)
  const allowed = useSessionStore().can(permission, project)

  if (binding.modifiers.disabled) {
    el.toggleAttribute('disabled', !allowed)
    el.setAttribute('aria-disabled', String(!allowed))
    if (allowed) el.removeAttribute('title')
    else el.setAttribute('title', DENIED_REASON)
    return
  }

  el.hidden = !allowed
  // `hidden` no gana a las utilidades de Tailwind que fijan `display`.
  el.style.display = allowed ? '' : 'none'
}

export const vCan: Directive<HTMLElement, CanValue> = {
  mounted: apply,
  updated: apply,
}
