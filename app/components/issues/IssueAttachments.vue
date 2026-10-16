<script setup lang="ts">
import type { Attachment, Issue } from '../../../shared/redmine/types'
import { useQueryClient } from '@tanstack/vue-query'
import { formatBytes } from '../../../shared/redmine/files'
import { attachmentDownloadPath } from '../../../shared/redmine/paths'

/**
 * Adjuntos de la tarea (F3-T06): lista con descarga y miniatura de las imágenes
 * (se amplían en un diálogo). Quien puede editar o comentar la tarea sube
 * arrastrando sobre el panel o eligiendo, con progreso por archivo; un archivo
 * mayor que el límite de Redmine se rechaza con su mensaje.
 */
const props = defineProps<{ issue: Issue }>()

const redmine = useRedmine()
const session = useSessionStore()
const toasts = useToastStore()
const queryClient = useQueryClient()
const { uploads, busy, sendAll, clearFinished } = useUploads()

const attachments = computed(() => props.issue.attachments ?? [])
const isImage = (file: Attachment) => !!file.content_type?.startsWith('image/')
const images = computed(() => attachments.value.filter(isImage))
const others = computed(() => attachments.value.filter(f => !isImage(f)))

const canAttach = computed(() => {
  const project = props.issue.project.id
  return session.can('edit_issues', project)
    || session.can('add_issue_notes', project)
    || (props.issue.author.id === session.user?.id && session.can('edit_own_issues', project))
})

const dragging = ref(false)
const picker = useTemplateRef<HTMLInputElement>('picker')

async function upload(list: FileList | File[]): Promise<void> {
  const files = [...list]
  if (files.length === 0) return
  const done = await sendAll(files, (token, file) => redmine.updateIssue(props.issue.id, {
    uploads: [{ token, filename: file.name, content_type: file.type || 'application/octet-stream' }],
  }))
  await queryClient.invalidateQueries({ queryKey: ['issues', 'detail', props.issue.id] })
  if (done > 0) toasts.show(done === 1 ? 'Archivo adjuntado' : `${done} archivos adjuntados`)
}

function onDrop(event: DragEvent): void {
  dragging.value = false
  if (!canAttach.value || !event.dataTransfer?.files.length) return
  void upload(event.dataTransfer.files)
}

function onPick(event: Event): void {
  const input = event.target as HTMLInputElement
  if (input.files) void upload([...input.files])
  input.value = ''
}

const preview = ref<Attachment | null>(null)
const previewOpen = computed({
  get: () => preview.value !== null,
  set: (value: boolean) => {
    if (!value) preview.value = null
  },
})
</script>

<template>
  <UiPanel label="Adjuntos">
    <template #header>
      <h2 class="panel-label !text-content">
        Adjuntos
      </h2>
      <span class="data ml-auto text-[length:var(--text-caption)] text-secondary">{{ attachments.length }}</span>
      <UiButton
        v-if="canAttach"
        label="Adjuntar archivos"
        icon="lucide:paperclip"
        icon-only
        variant="ghost"
        @click="picker?.click()"
      />
      <input
        ref="picker"
        type="file"
        multiple
        class="sr-only"
        tabindex="-1"
        aria-hidden="true"
        @change="onPick"
      >
    </template>

    <div
      class="flex flex-col gap-3 px-4 pb-4"
      :class="dragging ? 'bg-fill-selected' : ''"
      @dragover.prevent="canAttach && (dragging = true)"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <ul
        v-if="images.length > 0"
        class="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2"
      >
        <li
          v-for="file in images"
          :key="file.id"
        >
          <button
            type="button"
            class="group flex w-full flex-col gap-1 rounded-[var(--radius-control)] text-left"
            :aria-label="`Ver ${file.filename}`"
            @click="preview = file"
          >
            <img
              :src="attachmentDownloadPath(file)"
              :alt="file.description || file.filename"
              loading="lazy"
              class="aspect-[4/3] w-full rounded-[var(--radius-control)] border border-separator bg-fill-alt object-cover group-hover:brightness-95"
            >
            <span class="truncate text-[length:var(--text-caption)] text-secondary">{{ file.filename }}</span>
          </button>
        </li>
      </ul>

      <ul
        v-if="others.length > 0"
        class="flex flex-col"
      >
        <li
          v-for="file in others"
          :key="file.id"
        >
          <a
            :href="attachmentDownloadPath(file)"
            :download="file.filename"
            class="flex min-h-9 items-center gap-2 rounded-[var(--radius-control)] px-1 hover:bg-fill-hover"
          >
            <Icon
              name="lucide:file-down"
              class="size-4 shrink-0 text-secondary"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1 truncate">{{ file.filename }}</span>
            <span class="data shrink-0 text-[length:var(--text-caption)] text-secondary">{{ formatBytes(file.filesize) }}</span>
          </a>
        </li>
      </ul>

      <p
        v-if="attachments.length === 0 && uploads.length === 0"
        class="text-secondary"
      >
        {{ canAttach ? 'Sin adjuntos. Arrastra archivos aquí para adjuntarlos.' : 'Sin adjuntos.' }}
      </p>
      <p
        v-else-if="canAttach && uploads.length === 0"
        class="text-[length:var(--text-caption)] text-tertiary"
      >
        Arrastra archivos aquí para adjuntar más.
      </p>

      <FilesUploadList :uploads="uploads" />
      <UiButton
        v-if="uploads.length > 0 && !busy"
        label="Limpiar lista"
        variant="ghost"
        class="self-start"
        @click="clearFinished"
      />
    </div>

    <UiDialog
      v-model:open="previewOpen"
      :title="preview?.filename ?? ''"
      :description="preview?.description || undefined"
      :width="56"
    >
      <img
        v-if="preview"
        :src="attachmentDownloadPath(preview)"
        :alt="preview.description || preview.filename"
        class="mx-auto max-h-[55vh] rounded-[var(--radius-control)]"
      >
      <template #footer>
        <UiButton
          v-if="preview"
          label="Descargar"
          icon="lucide:download"
          :to="attachmentDownloadPath(preview)"
          :download="preview.filename"
          external
        />
      </template>
    </UiDialog>
  </UiPanel>
</template>
