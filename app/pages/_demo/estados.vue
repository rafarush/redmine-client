<script setup lang="ts">
import { DEFAULT_SORT } from '../../../shared/redmine/issue-query'

/**
 * Ruta de desarrollo (F2-T09): los estados de la lista uno junto a otro para
 * revisarlos sin forzar errores de red. `nuxt.config.ts` la quita del build de
 * producción.
 */
definePageMeta({ title: 'Estados de la lista' })

const demoError = new Error('Failed to fetch')
const toasts = useToastStore()
const say = (text: string) => toasts.show(text)

const STATES = [
  { id: 'loading', title: 'Cargando (primera vez)', props: { loading: true } },
  { id: 'empty', title: 'Vacío sin filtros', props: {} },
  { id: 'empty-filtered', title: 'Vacío con filtros', props: { filtered: true } },
  { id: 'error', title: 'Error de red', props: { error: demoError } },
] as const
</script>

<template>
  <div class="flex flex-col gap-6 px-3 pb-6 wide:px-6">
    <section
      v-for="state in STATES"
      :key="state.id"
      :aria-labelledby="`demo-${state.id}`"
      class="flex flex-col gap-2"
    >
      <h2
        :id="`demo-${state.id}`"
        class="panel-label"
      >
        {{ state.title }}
      </h2>
      <div class="flex h-72 flex-col overflow-hidden rounded-[var(--radius-surface)] border border-separator bg-raised">
        <IssuesIssueTable
          :issues="[]"
          :total-count="0"
          :sort="DEFAULT_SORT"
          v-bind="state.props"
          @retry="say('Reintentar')"
          @clear-filters="say('Quitar filtros')"
        />
      </div>
    </section>
  </div>
</template>
