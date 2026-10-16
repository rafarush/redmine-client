<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { formatBytes, groupFilesByVersion } from '../../../../shared/redmine/files'
import { explainRejection } from '../../../../shared/redmine/issue-actions'
import { attachmentDownloadPath } from '../../../../shared/redmine/paths'

/**
 * Archivos del proyecto (F7-T05): agrupados por versión con tamaño, autor y fecha,
 * y descarga por el proxy. Con `manage_files`, subir arrastrando o eligiendo, con
 * progreso por archivo. Cancelar corta la subida antes de añadirla al proyecto, así
 * que no queda nada a medias (el contenido subido sin añadir lo descarta Redmine).
 */
definePageMeta({ title: 'Archivos' })

const route = useRoute()
const redmine = useRedmine()
const session = useSessionStore()
const toasts = useToastStore()
const queryClient = useQueryClient()

const project = useProjectRef(() => String(route.params.id))
const allowed = computed(() => !!project.value && session.can('view_files', project.value.id))
const canUpload = computed(() => !!project.value && session.can('manage_files', project.value.id))

const pageTitle = useState<string | null>('page-title')
watchEffect(() => {
  pageTitle.value = project.value ? `Archivos · ${project.value.name}` : null
})
onBeforeUnmount(() => {
  pageTitle.value = null
})

const files = useQuery({
  queryKey: computed(() => ['project-files', project.value?.id]),
  queryFn: () => redmine.listProjectFiles(project.value!.identifier),
  enabled: allowed,
})
const versions = useProjectVersions(() => allowed.value ? project.value?.id : undefined)
const groups = computed(() => groupFilesByVersion(files.data.value ?? [], versions.data.value ?? []))
const total = computed(() => files.data.value?.length ?? 0)

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })

// ------------------------------------------------------------------ subir

type UploadState = 'uploading' | 'attaching' | 'done' | 'error' | 'cancelled'
interface Upload {
  id: number
  name: string
  size: number
  loaded: number
  state: UploadState
  error?: string
  controller: AbortController
}

const uploads = ref<Upload[]>([])
const versionId = ref<number | ''>('')
const description = ref('')
const dragging = ref(false)
const picker = useTemplateRef<HTMLInputElement>('picker')
let nextId = 1

const openVersions = computed(() => (versions.data.value ?? []).filter(v => v.status !== 'closed'))
const busy = computed(() => uploads.value.some(u => u.state === 'uploading' || u.state === 'attaching'))

function patch(id: number, changes: Partial<Upload>): void {
  uploads.value = uploads.value.map(u => u.id === id ? { ...u, ...changes } : u)
}

async function send(file: File): Promise<boolean> {
  if (!project.value) return false
  const upload: Upload = { id: nextId++, name: file.name, size: file.size, loaded: 0, state: 'uploading', controller: new AbortController() }
  uploads.value = [...uploads.value, upload]
  const { signal } = upload.controller
  try {
    const token = await redmine.upload(file, file.name, {
      signal,
      onProgress: loaded => patch(upload.id, { loaded }),
    })
    // Cancelado justo al terminar la subida: no se añade al proyecto.
    if (signal.aborted) throw new DOMException('Subida cancelada', 'AbortError')
    patch(upload.id, { state: 'attaching', loaded: file.size })
    await redmine.addProjectFile(project.value.identifier, {
      token,
      filename: file.name,
      version_id: versionId.value === '' ? undefined : versionId.value,
      description: description.value.trim() || undefined,
    })
    patch(upload.id, { state: 'done' })
    return true
  }
  catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') patch(upload.id, { state: 'cancelled' })
    else patch(upload.id, { state: 'error', error: explainRejection(error) })
    return false
  }
}

async function sendAll(list: FileList | File[]): Promise<void> {
  const chosen = [...list]
  if (chosen.length === 0) return
  const results = await Promise.all(chosen.map(send))
  await queryClient.invalidateQueries({ queryKey: ['project-files'] })
  const done = results.filter(Boolean).length
  if (done > 0) toasts.show(done === 1 ? 'Archivo subido' : `${done} archivos subidos`)
}

function onDrop(event: DragEvent): void {
  dragging.value = false
  if (!canUpload.value || !event.dataTransfer?.files.length) return
  void sendAll(event.dataTransfer.files)
}

function onPick(event: Event): void {
  const input = event.target as HTMLInputElement
  if (input.files) void sendAll(input.files)
  input.value = ''
}

function clearFinished(): void {
  uploads.value = uploads.value.filter(u => u.state === 'uploading' || u.state === 'attaching')
}

const STATE_LABEL: Record<UploadState, string> = {
  uploading: 'Subiendo',
  attaching: 'Añadiendo al proyecto',
  done: 'Subido',
  error: 'Error',
  cancelled: 'Cancelado',
}
const STATE_ICON: Record<UploadState, string> = {
  uploading: 'lucide:upload',
  attaching: 'lucide:loader',
  done: 'lucide:circle-check',
  error: 'lucide:circle-alert',
  cancelled: 'lucide:circle-x',
}

const FIELD = 'min-h-[var(--control-min)] rounded-[var(--radius-control)] border border-separator bg-surface px-2.5'
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 px-3 pb-6 wide:px-6">
    <Teleport
      defer
      to="#toolbar-actions"
    >
      <UiButton
        v-if="project"
        :label="`Volver a ${project.name}`"
        icon="lucide:arrow-left"
        icon-only
        variant="ghost"
        :to="`/projects/${project.identifier}`"
      />
    </Teleport>

    <p
      v-if="!project || !allowed"
      role="alert"
      class="py-16 text-center text-secondary"
    >
      {{ project ? 'Este proyecto no tiene el módulo de archivos activado o no tienes permiso para verlos.' : `No encuentro el proyecto "${route.params.id}".` }}
    </p>

    <template v-else>
      <section
        v-if="canUpload"
        aria-label="Subir archivos"
        class="flex flex-col gap-3 rounded-[var(--radius-surface)] border-2 border-dashed p-4 transition-colors"
        :class="dragging ? 'border-content bg-fill-selected' : 'border-separator bg-raised'"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <div class="flex flex-wrap items-center gap-3">
          <Icon
            name="lucide:upload"
            class="size-5 text-secondary"
            aria-hidden="true"
          />
          <p class="flex-1 text-secondary">
            Suelta aquí los archivos o
            <button
              type="button"
              class="font-medium text-content underline underline-offset-4"
              @click="picker?.click()"
            >
              elígelos
            </button>
          </p>
          <input
            ref="picker"
            type="file"
            multiple
            class="sr-only"
            tabindex="-1"
            aria-hidden="true"
            @change="onPick"
          >
        </div>
        <div class="flex flex-wrap gap-3">
          <label class="flex items-center gap-2">
            <span class="panel-label">Versión</span>
            <select
              v-model="versionId"
              :class="FIELD"
            >
              <option value="">
                Sin versión
              </option>
              <option
                v-for="v in openVersions"
                :key="v.id"
                :value="v.id"
              >
                {{ v.name }}
              </option>
            </select>
          </label>
          <label class="flex min-w-48 flex-1 items-center gap-2">
            <span class="panel-label">Descripción</span>
            <input
              v-model="description"
              type="text"
              placeholder="Opcional"
              :class="[FIELD, 'min-w-0 flex-1']"
            >
          </label>
        </div>

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
                :name="STATE_ICON[upload.state]"
                class="size-4 shrink-0"
                :class="upload.state === 'error' ? 'text-warning' : upload.state === 'done' ? 'text-success' : 'text-secondary'"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1 truncate">{{ upload.name }}</span>
              <span
                class="shrink-0 text-[length:var(--text-caption)]"
                :class="upload.state === 'error' ? 'text-warning' : 'text-secondary'"
              >
                {{ STATE_LABEL[upload.state] }}<template v-if="upload.state === 'uploading'"> · <span class="data">{{ formatBytes(upload.loaded) }} de {{ formatBytes(upload.size) }}</span></template><template v-if="upload.error">: {{ upload.error }}</template>
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
        <UiButton
          v-if="uploads.length > 0 && !busy"
          label="Limpiar lista"
          variant="ghost"
          class="self-start"
          @click="clearFinished"
        />
      </section>

      <div
        v-if="files.isPending.value"
        class="flex flex-col gap-2"
        aria-busy="true"
        aria-label="Cargando archivos"
      >
        <div
          v-for="n in 4"
          :key="n"
          class="h-11 rounded-[var(--radius-control)] bg-fill-selected motion-safe:animate-pulse"
        />
      </div>
      <div
        v-else-if="files.error.value"
        role="alert"
        class="flex flex-col items-center gap-3 py-10 text-center"
      >
        <p class="text-secondary">
          No se pudieron leer los archivos.
        </p>
        <UiButton
          label="Reintentar"
          icon="lucide:rotate-cw"
          @click="files.refetch()"
        />
      </div>
      <p
        v-else-if="total === 0"
        class="py-10 text-center text-secondary"
      >
        Este proyecto aún no tiene archivos.
      </p>

      <UiPanel
        v-for="group in groups"
        v-else
        :key="group.version?.id ?? 'none'"
        :label="group.version?.name ?? 'Sin versión'"
      >
        <template #header>
          <h2 class="panel-label !text-content">
            {{ group.version?.name ?? 'Sin versión' }}
          </h2>
          <span class="data ml-auto text-[length:var(--text-caption)] text-secondary">{{ group.files.length }}</span>
        </template>
        <ul class="flex flex-col border-t border-separator">
          <li
            v-for="(file, i) in group.files"
            :key="file.id"
            :class="i % 2 ? 'bg-fill-alt' : ''"
          >
            <a
              :href="attachmentDownloadPath(file)"
              :download="file.filename"
              class="grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-1.5 hover:bg-fill-hover wide:grid-cols-[auto_minmax(0,1fr)_10rem_7rem_5rem]"
            >
              <Icon
                name="lucide:file-down"
                class="size-4 text-secondary"
                aria-hidden="true"
              />
              <span class="min-w-0">
                <span class="block truncate font-medium">{{ file.filename }}</span>
                <span
                  v-if="file.description"
                  class="block truncate text-[length:var(--text-caption)] text-secondary"
                >{{ file.description }}</span>
              </span>
              <span class="hidden truncate text-secondary wide:block">{{ file.author?.name ?? '' }}</span>
              <span class="data hidden text-secondary wide:block">{{ dateFormat.format(new Date(file.created_on)).replace('.', '') }}</span>
              <span class="data text-right text-secondary">{{ formatBytes(file.filesize) }}</span>
            </a>
          </li>
        </ul>
      </UiPanel>
    </template>
  </div>
</template>
