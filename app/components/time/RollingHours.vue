<script setup lang="ts">
import { animate } from 'motion-v'

/**
 * El momento de movimiento (F4-T04, `02-diseno.md › Movimiento`): cuando las horas
 * de una tarea suben, la cifra rueda hasta el nuevo valor con un resorte corto y
 * el ⏱ de la fila da un pulso. Con `prefers-reduced-motion` el número cambia sin
 * más. Sin horas se escribe un guion, no "0,0". Nada bloquea: si llega otro
 * cambio, la animación anterior se para.
 */
const props = defineProps<{
  hours: number | null | undefined
  /** Para encontrar el ⏱ de la misma fila (`data-log-time`). */
  issueId?: number
}>()

const format = new Intl.NumberFormat('es', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
const shown = ref(props.hours ?? 0)
let running: { stop: () => void } | undefined

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

watch(() => props.hours ?? 0, (next, previous) => {
  running?.stop()
  if (reducedMotion() || next <= previous) {
    shown.value = next
    return
  }
  running = animate(previous, next, {
    type: 'spring',
    visualDuration: 0.35,
    bounce: 0.15,
    onUpdate: (value: number) => {
      shown.value = value
    },
  })
  const timer = props.issueId ? document.querySelector<HTMLElement>(`[data-log-time="${props.issueId}"]`) : null
  if (timer) animate(timer, { scale: [1, 1.25, 1] }, { duration: 0.4, ease: 'easeOut' })
})

onBeforeUnmount(() => running?.stop())
</script>

<template>
  <span :aria-label="hours ? `${format.format(hours)} horas` : 'Sin horas'">
    <span aria-hidden="true">{{ hours || shown ? format.format(shown) : '—' }}</span>
  </span>
</template>
