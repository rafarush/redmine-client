<script setup lang="ts">
import { TooltipProvider } from 'reka-ui'
</script>

<template>
  <!-- Un solo proveedor de tooltips para toda la app: comparte el retardo de apertura. -->
  <TooltipProvider :delay-duration="400">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </TooltipProvider>
</template>
