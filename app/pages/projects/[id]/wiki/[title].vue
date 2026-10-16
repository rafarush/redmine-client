<script setup lang="ts">
import type { TextFormat } from '../../../../../shared/redmine/rich-text'
import { useQueryClient } from '@tanstack/vue-query'
import { explainRejection } from '../../../../../shared/redmine/issue-actions'
import { attachmentDownloadPath } from '../../../../../shared/redmine/paths'
import { resolveFormat } from '../../../../../shared/redmine/rich-text'
import { RedmineError } from '../../../../../shared/redmine/transport'
import { lineDiff, resolveWikiLinks, wikiLabel } from '../../../../../shared/redmine/wiki'

/**
 * Página de la wiki (F7-T02 y F7-T03): texto con formato y saneado, enlaces
 * `[[Página]]` y `#N` dentro de la app, índice lateral si es larga, adjuntos y
 * "Ver en Redmine". Edición con vista previa al lado y `version` para no pisar
 * cambios ajenos: ante un 409 se enseñan las diferencias y se ofrece copiar lo
 * escrito o recargar, nunca se sobrescribe en silencio.
 */
definePageMeta({ title: 'Wiki' })

const route = useRoute()
const router = useRouter()
const redmine = useRedmine()
const session = useSessionStore()
const toasts = useToastStore()
const preferences = usePreferencesStore()
const queryClient = useQueryClient()

const project = useProjectRef(() => String(route.params.id))
const title = computed(() => String(route.params.title))
const allowed = computed(() => !!project.value && session.can('view_wiki_pages', project.value.id))
const canEdit = computed(() => !!project.value && session.can('edit_wiki_pages', project.value.id))
const page = useWikiPage(() => allowed.value ? project.value?.identifier : undefined, title)
const index = useWikiIndex(() => allowed.value ? project.value?.identifier : undefined)

const pageTitle = useState<string | null>('page-title')
watchEffect(() => {
  pageTitle.value = wikiLabel(title.value)
})
onBeforeUnmount(() => {
  pageTitle.value = null
})

const redmineUrl = computed(() => project.value
  ? `${session.url.replace(/\/$/, '')}/projects/${project.value.identifier}/wiki/${encodeURIComponent(title.value)}`
  : '')

const parent = computed(() => page.data.value?.parent?.title)
const children = computed(() => (index.data.value ?? []).filter(p => p.parent?.title === title.value))

function linkWiki(text: string, format: TextFormat): string {
  return resolveWikiLinks(text, project.value?.identifier ?? '', format)
}

// ------------------------------------------------------- índice de la página

const body = useTemplateRef<HTMLElement>('body')
const headings = ref<{ id: string, text: string, level: number }[]>([])

/** Da un id a cada título del texto ya pintado y los lista para el índice lateral. */
function collectHeadings(): void {
  const found: { id: string, text: string, level: number }[] = []
  const used = new Set<string>()
  for (const el of body.value?.querySelectorAll<HTMLElement>('h1, h2, h3') ?? []) {
    const base = (el.textContent ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'seccion'
    let id = base
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`
    used.add(id)
    el.id = id
    found.push({ id, text: el.textContent?.trim() ?? '', level: Number(el.tagName[1]) })
  }
  headings.value = found
}

watch(() => [page.data.value?.text, preferences.textFormat], () => nextTick(collectHeadings), { immediate: true })
watch(body, () => nextTick(collectHeadings))

// ------------------------------------------------------------------ edición

const editing = ref(false)
const draft = ref('')
const comment = ref('')
const baseVersion = ref<number | undefined>()
const saving = ref(false)
/** Texto que hay ahora en Redmine cuando el guardado choca (409). */
const conflict = ref<{ theirs: string, version: number } | null>(null)

function startEditing(): void {
  draft.value = page.data.value?.text ?? ''
  baseVersion.value = page.data.value?.version
  comment.value = ''
  conflict.value = null
  editing.value = true
}

// `?edit=1` (desde "Nueva página" o "Crearla") abre directamente el editor.
watch(() => [page.isSuccess.value, route.query.edit] as const, ([ready, edit]) => {
  if (ready && edit && canEdit.value && !editing.value) {
    startEditing()
    void router.replace({ query: { ...route.query, edit: undefined } })
  }
}, { immediate: true })

const editorFormat = computed(() => resolveFormat(draft.value, preferences.textFormat))

async function save(): Promise<void> {
  if (!project.value || saving.value) return
  saving.value = true
  try {
    await redmine.saveWikiPage(project.value.identifier, title.value, {
      text: draft.value,
      comments: comment.value.trim() || undefined,
      version: baseVersion.value,
    })
    editing.value = false
    toasts.show(page.data.value ? 'Página guardada' : 'Página creada')
    await queryClient.invalidateQueries({ queryKey: ['wiki', project.value.identifier] })
  }
  catch (error) {
    if (error instanceof RedmineError && error.status === 409) {
      const fresh = await redmine.getWikiPage(project.value.identifier, title.value)
      conflict.value = { theirs: fresh.text, version: fresh.version }
    }
    else {
      toasts.show(`No se pudo guardar la página: ${explainRejection(error)}`)
    }
  }
  finally {
    saving.value = false
  }
}

const diff = computed(() => conflict.value ? lineDiff(conflict.value.theirs, draft.value) : [])

async function copyMine(): Promise<void> {
  try {
    await navigator.clipboard.writeText(draft.value)
    toasts.show('Tu texto está copiado')
  }
  catch {
    toasts.show('No se pudo copiar: selecciona el texto del editor y cópialo a mano')
  }
}

/** Recargar: se trae lo de Redmine y se sigue editando sobre ello (lo propio, mejor copiarlo antes). */
async function reload(): Promise<void> {
  if (!conflict.value) return
  draft.value = conflict.value.theirs
  baseVersion.value = conflict.value.version
  conflict.value = null
  await page.refetch()
}

function onEditorKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    void save()
  }
}

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const sizeFormat = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1_048_576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1_048_576).toFixed(1)} MB`
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 px-3 pb-6 wide:px-6">
    <Teleport
      defer
      to="#toolbar-actions"
    >
      <UiButton
        v-if="project"
        label="Índice de la wiki"
        icon="lucide:list-tree"
        icon-only
        variant="ghost"
        :to="`/projects/${project.identifier}/wiki`"
      />
      <UiButton
        v-if="project && page.data.value"
        label="Ver en Redmine"
        icon="lucide:external-link"
        icon-only
        variant="ghost"
        :to="redmineUrl"
        target="_blank"
        rel="noopener"
      />
    </Teleport>

    <p
      v-if="!project || !allowed"
      role="alert"
      class="py-16 text-center text-secondary"
    >
      {{ project ? 'Este proyecto no tiene la wiki activada o no tienes permiso para leerla.' : `No encuentro el proyecto "${route.params.id}".` }}
    </p>

    <div
      v-else-if="page.isPending.value"
      class="flex flex-col gap-3"
      aria-busy="true"
      aria-label="Cargando la página"
    >
      <div class="h-6 w-64 rounded-[var(--radius-plate)] bg-fill-selected motion-safe:animate-pulse" />
      <div class="h-64 rounded-[var(--radius-surface)] bg-fill-selected motion-safe:animate-pulse" />
    </div>

    <div
      v-else-if="page.error.value"
      role="alert"
      class="flex flex-col items-center gap-3 py-16 text-center"
    >
      <p class="text-secondary">
        No se pudo leer la página.
      </p>
      <UiButton
        label="Reintentar"
        icon="lucide:rotate-cw"
        @click="page.refetch()"
      />
    </div>

    <!-- Edición: editor y vista previa lado a lado (apilados en compacto). -->
    <template v-else-if="editing">
      <section
        v-if="conflict"
        role="alert"
        aria-labelledby="conflict-title"
        class="flex flex-col gap-3 rounded-[var(--radius-surface)] border border-warning bg-raised p-4 shadow-panel"
      >
        <h2
          id="conflict-title"
          class="flex items-center gap-2 font-semibold text-warning"
        >
          <Icon
            name="lucide:triangle-alert"
            class="size-4"
            aria-hidden="true"
          />
          Alguien cambió esta página mientras la editabas
        </h2>
        <p class="text-secondary">
          No se ha guardado nada. Abajo, en rojo lo que hay ahora en Redmine y en verde lo tuyo. Copia tu texto antes de recargar si quieres conservarlo.
        </p>
        <pre class="data max-h-72 overflow-auto rounded-[var(--radius-control)] border border-separator bg-surface p-2 text-[length:var(--text-caption)]"><template
          v-for="(line, i) in diff"
          :key="i"
        ><span
          class="block whitespace-pre-wrap"
          :class="line.kind === 'add' ? 'bg-success/15' : line.kind === 'del' ? 'bg-warning/15' : 'text-secondary'"
        ><span aria-hidden="true">{{ line.kind === 'add' ? '+ ' : line.kind === 'del' ? '− ' : '  ' }}</span><span class="sr-only">{{ line.kind === 'add' ? 'Tuyo: ' : line.kind === 'del' ? 'En Redmine: ' : '' }}</span>{{ line.text }}</span></template></pre>
        <div class="flex flex-wrap gap-2">
          <UiButton
            label="Copiar mi texto"
            icon="lucide:copy"
            @click="copyMine"
          />
          <UiButton
            label="Recargar"
            icon="lucide:rotate-cw"
            @click="reload"
          />
        </div>
      </section>

      <div class="grid gap-4 wide:grid-cols-2">
        <label class="flex flex-col gap-1">
          <span class="panel-label">Texto · {{ editorFormat === 'markdown' ? 'Markdown' : 'Textile' }}</span>
          <textarea
            v-model="draft"
            rows="20"
            class="data min-h-80 w-full resize-y rounded-[var(--radius-control)] border border-separator bg-surface px-3 py-2"
            @keydown="onEditorKeydown"
            @keydown.esc.prevent="editing = false"
          />
        </label>
        <div class="flex flex-col gap-1">
          <span class="panel-label">Vista previa</span>
          <div class="min-h-80 rounded-[var(--radius-control)] border border-separator bg-raised px-4 py-3">
            <TextRichText
              v-if="draft.trim()"
              :text="draft"
              :transform="linkWiki"
            />
            <p
              v-else
              class="text-secondary"
            >
              Nada que previsualizar.
            </p>
          </div>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <input
          v-model="comment"
          type="text"
          placeholder="Qué has cambiado (opcional)"
          aria-label="Comentario del cambio"
          class="min-h-[var(--control-min)] min-w-0 flex-1 rounded-[var(--radius-control)] border border-separator bg-surface px-2.5"
        >
        <UiButton
          label="Cancelar"
          variant="ghost"
          @click="editing = false"
        />
        <UiButton
          :label="saving ? 'Guardando…' : 'Guardar página'"
          variant="primary"
          shortcut="Mod+Enter"
          :disabled="saving || !!conflict"
          @click="save"
        />
      </div>
    </template>

    <!-- La página no existe todavía. -->
    <div
      v-else-if="!page.data.value"
      class="flex flex-col items-center gap-3 py-16 text-center"
    >
      <Icon
        name="lucide:file-plus"
        class="size-8 text-tertiary"
        aria-hidden="true"
      />
      <p class="text-secondary">
        Esta página aún no existe.
      </p>
      <UiButton
        v-if="canEdit"
        label="Crearla"
        icon="lucide:plus"
        variant="primary"
        @click="startEditing"
      />
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--text-caption)] text-secondary">
        <NuxtLink
          v-if="parent"
          :to="`/projects/${project.identifier}/wiki/${encodeURIComponent(parent)}`"
          class="inline-flex items-center gap-1 hover:text-content"
        >
          <Icon
            name="lucide:corner-left-up"
            class="size-3.5"
            aria-hidden="true"
          />
          {{ wikiLabel(parent) }}
        </NuxtLink>
        <span>
          Versión <span class="data">{{ page.data.value.version }}</span>
          <template v-if="page.data.value.updated_on"> · <span class="data">{{ dateFormat.format(new Date(page.data.value.updated_on)) }}</span></template>
          <template v-if="page.data.value.author"> · {{ page.data.value.author.name }}</template>
        </span>
        <UiButton
          v-if="canEdit"
          label="Editar"
          icon="lucide:pencil"
          class="ml-auto"
          @click="startEditing"
        />
      </div>

      <div
        class="grid items-start gap-4"
        :class="headings.length >= 3 ? 'wide:grid-cols-[minmax(0,1fr)_15rem]' : ''"
      >
        <div class="flex min-w-0 flex-col gap-4">
          <UiPanel :label="wikiLabel(title)">
            <div
              ref="body"
              class="px-5 py-4"
            >
              <TextRichText
                v-if="page.data.value.text.trim()"
                :text="page.data.value.text"
                :transform="linkWiki"
              />
              <p
                v-else
                class="text-secondary"
              >
                Esta página está vacía.
              </p>
            </div>
          </UiPanel>

          <UiPanel
            v-if="children.length > 0"
            label="Subpáginas"
          >
            <template #header>
              <h2 class="panel-label !text-content">
                Subpáginas
              </h2>
            </template>
            <ul class="flex flex-col pb-2">
              <li
                v-for="child in children"
                :key="child.title"
              >
                <NuxtLink
                  :to="`/projects/${project.identifier}/wiki/${encodeURIComponent(child.title)}`"
                  class="flex min-h-9 items-center gap-2 px-4 hover:bg-fill-hover"
                >
                  <Icon
                    name="lucide:file-text"
                    class="size-4 text-secondary"
                    aria-hidden="true"
                  />
                  {{ wikiLabel(child.title) }}
                </NuxtLink>
              </li>
            </ul>
          </UiPanel>

          <UiPanel
            v-if="page.data.value.attachments?.length"
            label="Adjuntos"
          >
            <template #header>
              <h2 class="panel-label !text-content">
                Adjuntos
              </h2>
            </template>
            <ul class="flex flex-col pb-2">
              <li
                v-for="file in page.data.value.attachments"
                :key="file.id"
              >
                <a
                  :href="attachmentDownloadPath(file)"
                  :download="file.filename"
                  class="flex min-h-9 items-center gap-2 px-4 hover:bg-fill-hover"
                >
                  <Icon
                    name="lucide:paperclip"
                    class="size-4 shrink-0 text-secondary"
                    aria-hidden="true"
                  />
                  <span class="min-w-0 flex-1 truncate">{{ file.filename }}</span>
                  <span class="data shrink-0 text-[length:var(--text-caption)] text-secondary">{{ sizeFormat(file.filesize) }}</span>
                </a>
              </li>
            </ul>
          </UiPanel>
        </div>

        <nav
          v-if="headings.length >= 3"
          aria-label="En esta página"
          class="sticky top-2 hidden flex-col gap-0.5 wide:flex"
        >
          <span class="panel-label px-2 pb-1">En esta página</span>
          <a
            v-for="heading in headings"
            :key="heading.id"
            :href="`#${heading.id}`"
            class="truncate rounded-[var(--radius-control)] py-1 pr-2 text-[length:var(--text-caption)] text-secondary hover:bg-fill-hover hover:text-content"
            :style="{ paddingLeft: `${0.5 + (heading.level - 1) * 0.75}rem` }"
          >{{ heading.text }}</a>
        </nav>
      </div>
    </template>
  </div>
</template>
