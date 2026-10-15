<script setup lang="ts">
/**
 * Botón del sistema de diseño.
 *
 * `label` es obligatorio siempre: es el texto visible y, cuando el botón solo
 * lleva icono, pasa a ser su `aria-label` (sdd/02-diseno.md › Iconos).
 * El acento Ruby queda reservado a la variante `primary`.
 */
const props = withDefaults(defineProps<{
  label: string
  variant?: 'primary' | 'secondary' | 'ghost'
  /** Nombre del icono Lucide, p. ej. `lucide:plus`. */
  icon?: string
  /** Oculta el texto y deja solo el icono. `label` sigue siendo la etiqueta accesible. */
  iconOnly?: boolean
  /** Atajo que se muestra en el tooltip, en notación de UiKbd. */
  shortcut?: string
  /** Si se indica, el botón se renderiza como enlace de navegación. */
  to?: string
  type?: 'button' | 'submit'
  disabled?: boolean
}>(), {
  variant: 'secondary',
  type: 'button',
})

/*
 * En la variante de solo icono la raíz es el tooltip, así que los atributos sueltos
 * (`aria-expanded`, `@click`, `data-*`) caerían en él y se perderían. Se bindean a mano
 * sobre el botón, que es donde tienen sentido.
 */
defineOptions({ inheritAttrs: false })

const VARIANT_STYLES = {
  primary: 'bg-accent text-on-accent font-semibold hover:brightness-110 active:brightness-95',
  secondary: 'bg-raised text-content border border-separator shadow-panel hover:bg-fill-hover',
  ghost: 'text-secondary hover:bg-fill-hover hover:text-content',
} as const

const classes = computed(() => [
  'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)]',
  'min-h-[var(--control-min)] text-[length:var(--text-body)] font-medium',
  'transition-[background-color,color,filter] duration-150 disabled:cursor-not-allowed disabled:opacity-50',
  props.iconOnly ? 'min-w-[var(--control-min)] px-0' : 'px-3',
  VARIANT_STYLES[props.variant],
])
</script>

<template>
  <UiTooltip
    v-if="iconOnly"
    :text="label"
    :shortcut="shortcut"
  >
    <component
      :is="to ? 'NuxtLink' : 'button'"
      :to="to"
      :type="to ? undefined : type"
      :disabled="to ? undefined : disabled"
      :aria-label="label"
      :class="classes"
      v-bind="$attrs"
    >
      <Icon
        v-if="icon"
        :name="icon"
        class="size-[18px] shrink-0"
        aria-hidden="true"
      />
    </component>
  </UiTooltip>

  <component
    :is="to ? 'NuxtLink' : 'button'"
    v-else
    :to="to"
    :type="to ? undefined : type"
    :disabled="to ? undefined : disabled"
    :class="classes"
    v-bind="$attrs"
  >
    <Icon
      v-if="icon"
      :name="icon"
      class="size-4 shrink-0"
      aria-hidden="true"
    />
    {{ label }}
  </component>
</template>
