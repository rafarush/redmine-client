/** Para mostrar ⌘ en vez de Ctrl en los atajos. Solo cliente: la app es SPA. */
export function useIsMac(): boolean {
  if (typeof navigator === 'undefined') return false
  return /mac/i.test(navigator.userAgent)
}
