<script setup lang="ts">
import type { IssueSort } from '../../shared/redmine/issue-query'
import { DEFAULT_SORT } from '../../shared/redmine/issue-query'

/** Pantalla principal: la lista de tareas. La frase de filtros llega en F2-T04. */
const sort = ref<IssueSort>({ ...DEFAULT_SORT })
const { issues, totalCount, isStale, hasNextPage, isFetchingNextPage, fetchNextPage } = useIssues({ sort })
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <IssuesIssueTable
      :issues="issues"
      :total-count="totalCount"
      :sort="sort"
      :stale="isStale"
      :has-more="hasNextPage"
      :loading-more="isFetchingNextPage"
      @sort="sort = $event"
      @load-more="fetchNextPage()"
    />
  </div>
</template>
