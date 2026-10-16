<script setup lang="ts">
import type { WikiNode } from '../../../shared/redmine/wiki'
import { wikiLabel } from '../../../shared/redmine/wiki'

/** Rama del índice de la wiki (F7-T01). */
defineProps<{
  node: WikiNode
  project: string
  depth: number
  /** Página abierta, para marcarla. */
  current?: string
}>()
</script>

<template>
  <li>
    <NuxtLink
      :to="`/projects/${project}/wiki/${encodeURIComponent(node.page.title)}`"
      :aria-current="current === node.page.title ? 'page' : undefined"
      class="flex min-h-9 items-center gap-2 rounded-[var(--radius-control)] px-2 text-[length:var(--text-body)] hover:bg-fill-hover aria-[current=page]:bg-fill-selected aria-[current=page]:font-semibold"
      :style="{ paddingLeft: `${0.5 + depth * 1}rem` }"
    >
      <Icon
        :name="node.children.length > 0 ? 'lucide:book-open' : 'lucide:file-text'"
        class="size-4 shrink-0 text-secondary"
        aria-hidden="true"
      />
      <span class="truncate">{{ wikiLabel(node.page.title) }}</span>
    </NuxtLink>
    <ul v-if="node.children.length > 0">
      <WikiTreeNode
        v-for="child in node.children"
        :key="child.page.title"
        :node="child"
        :project="project"
        :depth="depth + 1"
        :current="current"
      />
    </ul>
  </li>
</template>
