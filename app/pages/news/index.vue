<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { explainRejection } from '../../../shared/redmine/issue-actions'
import { newsExcerpt } from '../../../shared/redmine/news'

/**
 * Noticias (F7-T04): de todos tus proyectos o de uno (`?project=identificador`).
 * Publicar solo aparece si puedes `manage_news` en algún proyecto. Abrir la
 * sección marca las novedades como vistas.
 */
definePageMeta({ title: 'Noticias' })

const route = useRoute()
const router = useRouter()
const redmine = useRedmine()
const session = useSessionStore()
const newsStore = useNewsStore()
const toasts = useToastStore()
const queryClient = useQueryClient()

onMounted(() => newsStore.markSeen())

const readable = computed(() => session.catalogs.projects
  .filter(p => p.status !== 9 && session.can('view_news', p.id))
  .sort((a, b) => a.name.localeCompare(b.name, 'es')))
const projectKey = computed(() => typeof route.query.project === 'string' ? route.query.project : '')
const project = computed(() => readable.value.find(p => p.identifier === projectKey.value))

function selectProject(identifier: string): void {
  void router.replace({ query: { ...route.query, project: identifier || undefined } })
}

const news = useQuery({
  queryKey: computed(() => ['news', projectKey.value || 'all']),
  queryFn: async () => (await redmine.listNews(project.value?.identifier, { limit: 50 })).items,
})

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' })

// ---------------------------------------------------------------- publicar

const publishable = computed(() => readable.value.filter(p => session.can('manage_news', p.id)))
const open = ref(false)
const form = reactive({ project: '', title: '', summary: '', description: '' })
const saving = ref(false)

function startNew(): void {
  form.project = project.value && publishable.value.includes(project.value) ? project.value.identifier : publishable.value[0]?.identifier ?? ''
  form.title = ''
  form.summary = ''
  form.description = ''
  open.value = true
}

async function publish(): Promise<void> {
  if (!form.project || !form.title.trim() || !form.description.trim() || saving.value) return
  saving.value = true
  try {
    await redmine.createNews(form.project, { title: form.title.trim(), summary: form.summary.trim() || undefined, description: form.description })
    open.value = false
    toasts.show('Noticia publicada')
    await queryClient.invalidateQueries({ queryKey: ['news'] })
    newsStore.markSeen()
  }
  catch (error) {
    toasts.show(`No se pudo publicar la noticia: ${explainRejection(error)}`)
  }
  finally {
    saving.value = false
  }
}

const FIELD = 'min-h-[var(--control-min)] rounded-[var(--radius-control)] border border-separator bg-surface px-2.5'
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 px-3 pb-6 wide:px-6">
    <Teleport
      defer
      to="#toolbar-primary"
    >
      <UiButton
        v-if="publishable.length > 0"
        label="Publicar noticia"
        icon="lucide:megaphone"
        variant="primary"
        @click="startNew"
      />
    </Teleport>

    <UiPanel label="Noticias">
      <template #header>
        <label class="flex items-center gap-2">
          <span class="panel-label">Proyecto</span>
          <select
            :value="projectKey"
            :class="[FIELD, 'min-w-0']"
            @change="selectProject(($event.target as HTMLSelectElement).value)"
          >
            <option value="">
              Todos
            </option>
            <option
              v-for="p in readable"
              :key="p.id"
              :value="p.identifier"
            >
              {{ p.name }}
            </option>
          </select>
        </label>
      </template>

      <div
        v-if="news.isPending.value"
        class="flex flex-col gap-3 px-4 pb-4"
        aria-busy="true"
        aria-label="Cargando noticias"
      >
        <div
          v-for="n in 3"
          :key="n"
          class="h-16 rounded-[var(--radius-control)] bg-fill-selected motion-safe:animate-pulse"
        />
      </div>
      <div
        v-else-if="news.error.value"
        role="alert"
        class="flex flex-col items-center gap-3 px-4 py-8 text-center"
      >
        <p class="text-secondary">
          No se pudieron leer las noticias.
        </p>
        <UiButton
          label="Reintentar"
          icon="lucide:rotate-cw"
          @click="news.refetch()"
        />
      </div>
      <ol
        v-else-if="news.data.value?.length"
        class="flex flex-col divide-y divide-separator border-t border-separator"
      >
        <li
          v-for="item in news.data.value"
          :key="item.id"
        >
          <NuxtLink
            :to="`/news/${item.id}`"
            class="flex flex-col gap-1 px-4 py-3 hover:bg-fill-hover"
          >
            <span class="flex flex-wrap items-center gap-x-2 text-[length:var(--text-caption)] text-secondary">
              <UiPlate :name="item.project.name" />
              <span>{{ item.project.name }}</span>
              <span aria-hidden="true">·</span>
              <span class="data">{{ dateFormat.format(new Date(item.created_on)) }}</span>
              <span
                v-if="newsStore.lastSeen && item.created_on > newsStore.lastSeen"
                class="font-semibold text-content"
              >Nueva</span>
            </span>
            <span class="text-[length:var(--text-title)] font-semibold">{{ item.title }}</span>
            <span
              v-if="newsExcerpt(item)"
              class="text-secondary"
            >{{ newsExcerpt(item) }}</span>
          </NuxtLink>
        </li>
      </ol>
      <p
        v-else
        class="border-t border-separator px-4 py-8 text-center text-secondary"
      >
        {{ project ? `${project.name} no ha publicado noticias.` : 'No hay noticias en tus proyectos.' }}
      </p>
    </UiPanel>

    <UiDialog
      v-model:open="open"
      title="Publicar noticia"
      :width="36"
    >
      <form
        class="flex flex-col gap-4"
        @submit.prevent="publish"
      >
        <label class="flex flex-col gap-1">
          <span class="panel-label">Proyecto</span>
          <select
            v-model="form.project"
            :class="FIELD"
          >
            <option
              v-for="p in publishable"
              :key="p.id"
              :value="p.identifier"
            >
              {{ p.name }}
            </option>
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="panel-label">Título</span>
          <input
            v-model="form.title"
            type="text"
            required
            :class="FIELD"
          >
        </label>
        <label class="flex flex-col gap-1">
          <span class="panel-label">Resumen (opcional)</span>
          <input
            v-model="form.summary"
            type="text"
            :class="FIELD"
          >
        </label>
        <label class="flex flex-col gap-1">
          <span class="panel-label">Texto</span>
          <textarea
            v-model="form.description"
            rows="8"
            required
            :class="[FIELD, 'py-2']"
            @keydown.enter.ctrl.prevent="publish"
            @keydown.enter.meta.prevent="publish"
          />
        </label>
        <button
          type="submit"
          class="sr-only"
        >
          Publicar noticia
        </button>
      </form>
      <template #footer>
        <UiButton
          label="Cancelar"
          variant="ghost"
          @click="open = false"
        />
        <UiButton
          :label="saving ? 'Publicando…' : 'Publicar noticia'"
          variant="primary"
          :disabled="saving || !form.title.trim() || !form.description.trim()"
          @click="publish"
        />
      </template>
    </UiDialog>
  </div>
</template>
