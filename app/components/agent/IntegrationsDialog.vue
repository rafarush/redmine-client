<script setup lang="ts">
import type { AgentStatusMap } from '../../../shared/agent/model'
import { BRANCH_PATTERN } from '../../../shared/agent/events'
import { isLocalRunnerUrl } from '../../../shared/agent/model'

/**
 * Integraciones IA (F11-T05): el agente (Claude Code), dónde está el runner y su
 * token (los mismos que usa "Mejorar con IA"), la rama base y a qué estado de
 * Redmine lleva cada fase de la cola. "Probar conexión" dice si responde o por qué no.
 */
const open = useState('agent-integrations-open', () => false)
const store = useAgentStore()
const ai = useAiStore()
const runner = useAgentRunner()
const session = useSessionStore()
const toasts = useToastStore()

const draft = reactive({ runnerUrl: '', token: '', baseBranch: 'main', statusMap: {} as AgentStatusMap })
const testing = ref(false)
const result = ref<{ ok: boolean, text: string } | null>(null)

watch(open, (value) => {
  if (!value) return
  draft.runnerUrl = ai.runnerUrl
  draft.token = ai.runnerToken
  draft.baseBranch = store.config.baseBranch
  draft.statusMap = { ...store.config.statusMap }
  result.value = null
})

const urlOk = computed(() => isLocalRunnerUrl(draft.runnerUrl.trim()))
const branchOk = computed(() => BRANCH_PATTERN.test(draft.baseBranch.trim()))

function apply(): void {
  ai.runnerUrl = draft.runnerUrl.trim().replace(/\/+$/, '')
  ai.runnerToken = draft.token.trim()
}

async function test(): Promise<void> {
  apply()
  testing.value = true
  result.value = null
  try {
    const health = await runner.health()
    result.value = { ok: true, text: health.busy ? 'Conectado: el runner está trabajando en una tarea.' : 'Conectado: el runner está libre.' }
  }
  catch (error) {
    result.value = { ok: false, text: (error as Error).message }
  }
  finally {
    testing.value = false
  }
}

function save(): void {
  if (!urlOk.value || !branchOk.value) return
  apply()
  store.config = { ...store.config, runnerUrl: ai.runnerUrl, baseBranch: draft.baseBranch.trim(), statusMap: { ...draft.statusMap } }
  open.value = false
  toasts.show('Integraciones guardadas')
}

const PHASES: ReadonlyArray<{ key: keyof AgentStatusMap, label: string, hint: string }> = [
  { key: 'working', label: 'Empieza', hint: 'Cuando el agente coge la tarea.' },
  { key: 'pr_opened', label: 'PR abierta', hint: 'Lista para revisar.' },
  { key: 'blocked', label: 'Bloqueada', hint: 'Si falla o no puede terminarla.' },
]
const statusOptions = computed(() => [{ value: '', label: 'No cambiar' }, ...session.catalogs.statuses.map(s => ({ value: s.id, label: s.name }))])

const FIELD = 'min-h-[var(--control-min)] w-full rounded-[var(--radius-control)] border border-separator bg-surface px-2.5 aria-[invalid=true]:border-warning'
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Integraciones IA"
    description="El agente que trabaja la Cola de Agente: Claude Code en tu equipo."
    :width="34"
  >
    <form
      class="flex flex-col gap-5"
      @submit.prevent="save"
    >
      <section
        aria-labelledby="integrations-runner"
        class="flex flex-col gap-3"
      >
        <h3
          id="integrations-runner"
          class="font-semibold"
        >
          Runner local
        </h3>
        <p class="text-[length:var(--text-caption)] text-secondary">
          Arráncalo con <code class="data">pnpm agent:runner</code> en el repositorio; al arrancar imprime el token. El repo y los comandos de verificación los fija su configuración, no la app.
        </p>
        <label class="flex flex-col gap-1">
          <span class="panel-label">URL</span>
          <input
            v-model="draft.runnerUrl"
            type="url"
            placeholder="http://127.0.0.1:4317"
            :aria-invalid="!urlOk"
            :class="[FIELD, 'data']"
          >
          <span
            v-if="!urlOk"
            class="text-[length:var(--text-caption)] text-warning"
          >Solo un runner en este equipo (localhost o 127.0.0.1).</span>
        </label>
        <label class="flex flex-col gap-1">
          <span class="panel-label">Token</span>
          <input
            v-model="draft.token"
            type="password"
            autocomplete="off"
            :class="[FIELD, 'data']"
          >
          <span class="text-[length:var(--text-caption)] text-secondary">Solo se guarda mientras la pestaña está abierta.</span>
        </label>
        <div class="flex flex-wrap items-center gap-3">
          <UiButton
            label="Probar conexión"
            icon="lucide:plug-zap"
            :disabled="testing || !urlOk || !draft.token.trim()"
            @click="test"
          />
          <p
            v-if="result"
            role="status"
            class="inline-flex items-center gap-1.5 text-[length:var(--text-caption)]"
            :class="result.ok ? 'text-success' : 'text-warning'"
          >
            <Icon
              :name="result.ok ? 'lucide:circle-check' : 'lucide:circle-alert'"
              class="size-4"
              aria-hidden="true"
            />
            {{ result.text }}
          </p>
        </div>
      </section>

      <section
        aria-labelledby="integrations-git"
        class="flex flex-col gap-3"
      >
        <h3
          id="integrations-git"
          class="font-semibold"
        >
          Repositorio
        </h3>
        <label class="flex flex-col gap-1">
          <span class="panel-label">Rama base</span>
          <input
            v-model="draft.baseBranch"
            type="text"
            :aria-invalid="!branchOk"
            :class="[FIELD, 'data']"
          >
        </label>
      </section>

      <section
        aria-labelledby="integrations-states"
        class="flex flex-col gap-3"
      >
        <h3
          id="integrations-states"
          class="font-semibold"
        >
          Estados en Redmine
        </h3>
        <label
          v-for="phase in PHASES"
          :key="phase.key"
          class="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5"
        >
          <span class="font-semibold">{{ phase.label }}</span>
          <UiSelect
            :model-value="draft.statusMap[phase.key] ?? ''"
            :options="statusOptions"
            @update:model-value="draft.statusMap[phase.key] = $event ? Number($event) : undefined"
          />
          <span class="col-start-2 text-[length:var(--text-caption)] text-secondary">{{ phase.hint }}</span>
        </label>
      </section>
      <!-- Solo para que Enter envíe el formulario; el botón visible es el del pie. -->
      <button
        type="submit"
        class="sr-only"
        tabindex="-1"
        aria-hidden="true"
      >
        Guardar
      </button>
    </form>
    <template #footer>
      <UiButton
        label="Cancelar"
        variant="ghost"
        @click="open = false"
      />
      <UiButton
        label="Guardar"
        variant="primary"
        :disabled="!urlOk || !branchOk"
        @click="save"
      />
    </template>
  </UiDialog>
</template>
