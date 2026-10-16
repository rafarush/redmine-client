<script setup lang="ts">
import type { Upload } from '../../composables/useUploads'
import { formatBytes } from '../../../shared/redmine/files'
import { UPLOAD_ICON, UPLOAD_LABEL } from '../../composables/useUploads'

/** Progreso de cada subida, con cancelar mientras sube (F7-T05, F3-T06). */
defineProps<{ uploads: Upload[] }>()
</script>

<template>
  <ul
    v-if="uploads.length > 0"
    class="flex flex-col gap-2"
    aria-live="polite"
  >
    <li
      v-for="upload in uploads"
      :key="upload.id"
      class="flex flex-col gap-1"
    >
      <div class="flex items-center gap-2">
        <Icon
          :name="UPLOAD_ICON[upload.state]"
          class="size-4 shrink-0"
          :class="upload.state === 'error' ? 'text-warning' : upload.state === 'done' ? 'text-success' : 'text-secondary'"
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1 truncate">{{ upload.name }}</span>
        <span
          class="shrink-0 text-[length:var(--text-caption)]"
          :class="upload.state === 'error' ? 'text-warning' : 'text-secondary'"
        >
          {{ UPLOAD_LABEL[upload.state] }}<template v-if="upload.state === 'uploading'"> · <span class="data">{{ formatBytes(upload.loaded) }} de {{ formatBytes(upload.size) }}</span></template><template v-if="upload.error">: {{ upload.error }}</template>
        </span>
        <UiButton
          v-if="upload.state === 'uploading'"
          :label="`Cancelar la subida de ${upload.name}`"
          icon="lucide:x"
          icon-only
          variant="ghost"
          @click="upload.controller.abort()"
        />
      </div>
      <div
        v-if="upload.state === 'uploading' || upload.state === 'attaching'"
        class="h-1.5 overflow-hidden rounded-full bg-fill-selected"
        role="progressbar"
        :aria-label="`Subida de ${upload.name}`"
        aria-valuemin="0"
        :aria-valuemax="upload.size"
        :aria-valuenow="upload.loaded"
      >
        <div
          class="h-full rounded-full bg-content transition-[width] duration-200"
          :style="{ width: `${upload.size ? (upload.loaded / upload.size) * 100 : 100}%` }"
        />
      </div>
    </li>
  </ul>
</template>
