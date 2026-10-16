<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { attachmentDownloadPath } from '../../../shared/redmine/paths'

/**
 * Detalle de una noticia (F7-T04): texto con formato, adjuntos y comentarios. La
 * API de Redmine no permite comentar, así que "Comentar en Redmine" abre la web.
 */
definePageMeta({ title: 'Noticia' })

const route = useRoute()
const redmine = useRedmine()
const session = useSessionStore()
const id = computed(() => Number(route.params.id))

const news = useQuery({
  queryKey: computed(() => ['news', 'detail', id.value]),
  queryFn: () => redmine.getNews(id.value),
  enabled: computed(() => Number.isInteger(id.value) && id.value > 0),
})

const pageTitle = useState<string | null>('page-title')
watchEffect(() => {
  pageTitle.value = news.data.value?.title ?? null
})
onBeforeUnmount(() => {
  pageTitle.value = null
})

const redmineUrl = computed(() => `${session.url.replace(/\/$/, '')}/news/${id.value}`)
const comments = computed(() => (news.data.value?.comments ?? []).filter(c => c.content?.trim()))
const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 px-3 pb-6 wide:px-6">
    <Teleport
      defer
      to="#toolbar-actions"
    >
      <UiButton
        label="Todas las noticias"
        icon="lucide:arrow-left"
        icon-only
        variant="ghost"
        to="/news"
      />
      <UiButton
        label="Ver en Redmine"
        icon="lucide:external-link"
        icon-only
        variant="ghost"
        :to="redmineUrl"
        target="_blank"
        rel="noopener"
      />
    </Teleport>

    <div
      v-if="news.isPending.value"
      class="h-64 rounded-[var(--radius-surface)] bg-fill-selected motion-safe:animate-pulse"
      aria-busy="true"
      aria-label="Cargando la noticia"
    />

    <div
      v-else-if="news.error.value || !news.data.value"
      role="alert"
      class="flex flex-col items-center gap-3 py-16 text-center"
    >
      <p class="text-secondary">
        No se pudo abrir la noticia. Puede que no exista o que no tengas acceso.
      </p>
      <UiButton
        label="Reintentar"
        icon="lucide:rotate-cw"
        @click="news.refetch()"
      />
    </div>

    <template v-else>
      <p class="flex flex-wrap items-center gap-x-2 text-[length:var(--text-caption)] text-secondary">
        <UiPlate :name="news.data.value.project.name" />
        <span>{{ news.data.value.project.name }}</span>
        <span aria-hidden="true">·</span>
        <span class="data">{{ dateFormat.format(new Date(news.data.value.created_on)) }}</span>
        <template v-if="news.data.value.author">
          <span aria-hidden="true">·</span>{{ news.data.value.author.name }}
        </template>
      </p>

      <UiPanel :label="news.data.value.title">
        <div class="flex flex-col gap-3 px-5 py-4">
          <p
            v-if="news.data.value.summary"
            class="text-[length:var(--text-title)] text-secondary"
          >
            {{ news.data.value.summary }}
          </p>
          <TextRichText :text="news.data.value.description ?? ''" />
        </div>
      </UiPanel>

      <UiPanel
        v-if="news.data.value.attachments?.length"
        label="Adjuntos"
      >
        <template #header>
          <h2 class="panel-label !text-content">
            Adjuntos
          </h2>
        </template>
        <ul class="flex flex-col pb-2">
          <li
            v-for="file in news.data.value.attachments"
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
              <span class="truncate">{{ file.filename }}</span>
            </a>
          </li>
        </ul>
      </UiPanel>

      <UiPanel label="Comentarios">
        <template #header>
          <h2 class="panel-label !text-content">
            Comentarios
          </h2>
          <span class="data ml-auto text-[length:var(--text-caption)] text-secondary">{{ comments.length }}</span>
        </template>
        <ol
          v-if="comments.length > 0"
          class="flex flex-col"
        >
          <li
            v-for="(comment, i) in comments"
            :key="comment.id"
            class="px-4 py-3"
            :class="i % 2 ? 'bg-fill-alt' : ''"
          >
            <p class="flex items-baseline gap-2 text-[length:var(--text-caption)]">
              <span class="font-semibold text-content">{{ comment.author?.name ?? 'Alguien' }}</span>
              <span
                v-if="comment.created_on"
                class="data text-secondary"
              >{{ dateTimeFormat.format(new Date(comment.created_on)) }}</span>
            </p>
            <TextRichText
              :text="comment.content ?? ''"
              class="mt-1"
            />
          </li>
        </ol>
        <p
          v-else
          class="px-4 pb-2 text-secondary"
        >
          Nadie ha comentado todavía.
        </p>
        <div
          v-if="session.can('comment_news', news.data.value.project.id)"
          class="border-t border-separator px-4 py-3"
        >
          <UiButton
            label="Comentar en Redmine"
            icon="lucide:external-link"
            :to="`${redmineUrl}#add_comment_form`"
            target="_blank"
            rel="noopener"
          />
        </div>
      </UiPanel>
    </template>
  </div>
</template>
