<script setup lang="ts">
/** Página de una tarea (F3-T01): el detalle a pantalla completa, con enlace directo. */
definePageMeta({ title: 'Tarea' })

const route = useRoute()
const id = computed(() => Number(route.params.id))
</script>

<template>
  <IssuesIssueDetail :id="id" />
</template>
