<script setup lang="ts">
import type { QueueItem, QueueStatus } from '../../shared/agent/model'

/**
 * Cola de Agente (F11-T06): las tareas que Claude Code implementa de una en una.
 * Cada una con su fase (icono + texto), su log, la rama y el enlace a la PR, y
 * las acciones que tocan en cada fase. Sin agente configurado, "Configurar agente".
 */
definePageMeta({ title: 'Cola de Agente' })

const queue = useAgentQueue()
const { store, runner, connected } = queue
const integrationsOpen = useState('agent-integrations-open', () => false)

const PHASE: Record<QueueStatus, { label: string, icon: string, tone: string }> = {
  queued: { label: 'En cola', icon: 'lucide:clock', tone: 'text-secondary' },
  working: { label: 'Trabajando', icon: 'lucide:loader', tone: 'text-content' },
  testing: { label: 'Verificando', icon: 'lucide:flask-conical', tone: 'text-content' },
  pr_opened: { label: 'PR abierta', icon: 'lucide:git-pull-request', tone: 'text-success' },
  blocked: { label: 'Bloqueada', icon: 'lucide:circle-alert', tone: 'text-warning' },
  cancelled: { label: 'Cancelada', icon: 'lucide:circle-x', tone: 'text-tertiary' },
}

const expanded = ref<string | null>(null)
const queuedIds = computed(() => store.queue.filter(i => i.status === 'queued').map(i => i.id))

function moveBy(item: QueueItem, delta: number): void {
  const index = store.queue.findIndex(i => i.id === item.id)
  store.move(item.id, index + delta)
}

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 px-3 pb-6 wide:px-6">
    <Teleport
      defer
      to="#toolbar-actions"
    >
      <UiButton
        label="Integraciones IA"
        icon="lucide:settings"
        icon-only
        variant="ghost"
        @click="integrationsOpen = true"
      />
    </Teleport>

    <!-- Sin agente configurado. -->
    <div
      v-if="!runner.configured.value"
      class="flex flex-col items-center gap-3 py-16 text-center"
    >
      <Icon
        name="lucide:bot"
        class="size-8 text-tertiary"
        aria-hidden="true"
      />
      <p class="max-w-md text-secondary">
        Encola tareas de Redmine y Claude Code las implementa en tu equipo, una a una: rama propia, pruebas y PR. Primero, conecta el runner local.
      </p>
      <UiButton
        label="Configurar agente"
        icon="lucide:settings"
        variant="primary"
        @click="integrationsOpen = true"
      />
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p
          class="inline-flex items-center gap-1.5"
          role="status"
        >
          <Icon
            :name="connected ? 'lucide:circle-check' : 'lucide:circle-dashed'"
            class="size-4"
            :class="connected ? 'text-success' : 'text-warning'"
            aria-hidden="true"
          />
          {{ connected ? 'Runner conectado' : 'Buscando el runner… (¿está arrancado con pnpm agent:runner?)' }}
        </p>
        <p
          v-if="store.paused"
          class="inline-flex items-center gap-1.5 text-warning"
        >
          <Icon
            name="lucide:pause"
            class="size-4"
            aria-hidden="true"
          />
          Cola en pausa
        </p>
        <UiButton
          :label="store.paused ? 'Reanudar cola' : 'Pausar cola'"
          :icon="store.paused ? 'lucide:play' : 'lucide:pause'"
          class="ml-auto"
          @click="store.paused = !store.paused"
        />
      </div>

      <UiPanel label="Tareas de la cola">
        <template #header>
          <h2 class="panel-label !text-content">
            Tareas
          </h2>
          <span class="data ml-auto text-[length:var(--text-caption)] text-secondary">{{ store.queue.length }}</span>
        </template>

        <p
          v-if="store.queue.length === 0"
          class="border-t border-separator px-4 py-8 text-center text-secondary"
        >
          La cola está vacía. Añade tareas con clic derecho sobre una tarea › "Añadir a la cola del agente".
        </p>
        <ol
          v-else
          class="flex flex-col divide-y divide-separator border-t border-separator"
        >
          <li
            v-for="item in store.queue"
            :key="item.id"
            class="flex flex-col gap-2 px-4 py-3"
          >
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span
                class="inline-flex w-28 shrink-0 items-center gap-1.5 text-[length:var(--text-caption)] font-semibold"
                :class="PHASE[item.status].tone"
              >
                <Icon
                  :name="PHASE[item.status].icon"
                  class="size-4"
                  :class="item.status === 'working' ? 'motion-safe:animate-spin' : ''"
                  aria-hidden="true"
                />
                {{ PHASE[item.status].label }}
              </span>
              <NuxtLink
                :to="`/issues/${item.issueId}`"
                class="flex min-w-0 flex-1 items-baseline gap-2 hover:underline"
              >
                <span class="data shrink-0 text-secondary">#{{ item.issueId }}</span>
                <span class="truncate">{{ item.title }}</span>
              </NuxtLink>
              <span class="flex shrink-0 items-center gap-0.5">
                <a
                  v-if="item.prUrl"
                  :href="item.prUrl"
                  target="_blank"
                  rel="noopener"
                  class="inline-flex min-h-[var(--control-min)] items-center gap-1 rounded-[var(--radius-control)] px-2 font-medium hover:bg-fill-hover"
                >
                  <Icon
                    name="lucide:git-pull-request"
                    class="size-4"
                    aria-hidden="true"
                  />
                  Ver PR
                </a>
                <template v-if="item.status === 'queued'">
                  <UiButton
                    :label="`Subir #${item.issueId}`"
                    icon="lucide:chevron-up"
                    icon-only
                    variant="ghost"
                    :disabled="queuedIds[0] === item.id"
                    @click="moveBy(item, -1)"
                  />
                  <UiButton
                    :label="`Bajar #${item.issueId}`"
                    icon="lucide:chevron-down"
                    icon-only
                    variant="ghost"
                    :disabled="queuedIds.at(-1) === item.id"
                    @click="moveBy(item, 1)"
                  />
                </template>
                <UiButton
                  v-if="item.status === 'blocked' || item.status === 'cancelled'"
                  label="Reintentar"
                  icon="lucide:rotate-cw"
                  variant="ghost"
                  @click="queue.retry(item)"
                />
                <UiButton
                  v-if="item.status === 'queued' || item.status === 'working' || item.status === 'testing'"
                  label="Cancelar"
                  icon="lucide:x"
                  variant="ghost"
                  @click="queue.cancel(item)"
                />
                <UiButton
                  v-if="item.status !== 'working' && item.status !== 'testing'"
                  :label="`Quitar #${item.issueId} de la cola`"
                  icon="lucide:trash-2"
                  icon-only
                  variant="ghost"
                  @click="store.remove(item.id)"
                />
                <UiButton
                  :label="expanded === item.id ? 'Ocultar log' : 'Ver log'"
                  icon="lucide:scroll-text"
                  icon-only
                  variant="ghost"
                  :aria-expanded="expanded === item.id"
                  @click="expanded = expanded === item.id ? null : item.id"
                />
              </span>
            </div>
            <p class="flex flex-wrap gap-x-3 pl-[7.75rem] text-[length:var(--text-caption)] text-secondary">
              <span class="data">{{ dateFormat.format(new Date(item.addedAt)) }}</span>
              <span
                v-if="item.branch"
                class="data"
              >{{ item.branch }}</span>
              <span
                v-if="item.reason && item.status === 'blocked'"
                class="text-warning"
              >{{ item.reason }}</span>
            </p>
            <pre
              v-if="expanded === item.id"
              class="data max-h-72 overflow-auto whitespace-pre-wrap rounded-[var(--radius-control)] border border-separator bg-fill-alt p-2 text-[length:var(--text-caption)]"
              aria-label="Log del agente"
            >{{ (store.logs[item.id] ?? []).join('\n') || 'Sin líneas todavía (el log vive mientras la pestaña está abierta).' }}</pre>
          </li>
        </ol>
      </UiPanel>
    </template>
  </div>
</template>
