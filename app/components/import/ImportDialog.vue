<script setup lang="ts">
import type { ItemResult } from '../../../shared/import/batch'
import type { RawRow } from '../../../shared/import/read'
import type { ImportError } from '../../../shared/import/validate'
import { useQueryClient } from '@tanstack/vue-query'
import { runBatch, summarize } from '../../../shared/import/batch'
import { readWorkbook } from '../../../shared/import/read'
import { buildReport, reportFilename } from '../../../shared/import/report'
import { templateBuffer, templateFilename } from '../../../shared/import/template'
import { projectMismatch, validateRows } from '../../../shared/import/validate'
import { toUrl } from '../../../shared/redmine/filters'
import { explainRejection } from '../../../shared/redmine/issue-actions'

/**
 * "Importar tareas" (F5-T03..T06), en cuatro pasos dentro de un mismo diálogo:
 *
 * 1. Elegir o soltar el `.xlsx` (y "Descargar plantilla").
 * 2. Revisar: todas las filas, celdas con error marcadas con icono y texto,
 *    corregir en el sitio y excluir filas. Nada se crea sin confirmar.
 * 3. Crear: progreso "12 de 40", cancelable entre tarea y tarea.
 * 4. Resultado: resumen, enlaces y "Descargar reporte".
 */
const props = defineProps<{ projectId: number }>()
const open = defineModel<boolean>('open', { default: false })

const redmine = useRedmine()
const toasts = useToastStore()
const queryClient = useQueryClient()
const { catalog, ready, error: catalogError } = useImportCatalog(() => open.value ? props.projectId : undefined)

type Step = 'pick' | 'preview' | 'running' | 'result'
const step = ref<Step>('pick')
const pickError = ref('')
const loading = ref(false)
const dragging = ref(false)
const picker = useTemplateRef<HTMLInputElement>('picker')

const fileName = ref('')
const original = ref<ArrayBuffer | null>(null)
const headers = ref<string[]>([])
const rawRows = ref<RawRow[]>([])
const excluded = ref<Set<number>>(new Set())
const existingIds = ref<Set<number>>(new Set())

watch(open, (value) => {
  if (!value) return
  step.value = 'pick'
  pickError.value = ''
  rawRows.value = []
  excluded.value = new Set()
  results.value = []
})

// --------------------------------------------------------------- paso 1

async function downloadTemplate(): Promise<void> {
  if (!catalog.value) return
  downloadFile(await templateBuffer(catalog.value), templateFilename(catalog.value))
}

async function load(file: File): Promise<void> {
  pickError.value = ''
  if (!/\.xlsx$/i.test(file.name)) {
    pickError.value = `"${file.name}" no es un Excel (.xlsx). Usa la plantilla de importación.`
    return
  }
  if (!catalog.value) return
  loading.value = true
  try {
    const data = await file.arrayBuffer()
    const read = await readWorkbook(data)
    if (!read.ok) {
      pickError.value = read.error
      return
    }
    const mismatch = projectMismatch(read.meta, catalog.value)
    if (mismatch) {
      pickError.value = mismatch
      return
    }
    if (read.rows.length === 0) {
      pickError.value = 'La hoja "Tareas" no tiene filas que importar.'
      return
    }
    // Los padres "#id" tienen que existir: se comprueban todos de una vez.
    const parentIds = [...new Set(read.rows.flatMap((r) => {
      const match = /^#(\d+)$/.exec((r.cells['Padre (fila)'] ?? '').trim())
      return match ? [Number(match[1])] : []
    }))]
    existingIds.value = parentIds.length > 0
      ? new Set((await redmine.listIssues({ issue_id: parentIds.join(','), status_id: '*', limit: 100 })).items.map(i => i.id))
      : new Set()

    fileName.value = file.name
    original.value = data
    headers.value = read.headers
    rawRows.value = read.rows
    excluded.value = new Set()
    step.value = 'preview'
  }
  catch (error) {
    pickError.value = `No se pudo leer el archivo: ${explainRejection(error)}`
  }
  finally {
    loading.value = false
  }
}

function onDrop(event: DragEvent): void {
  dragging.value = false
  const file = event.dataTransfer?.files[0]
  if (file) void load(file)
}

function onPick(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void load(file)
  input.value = ''
}

// --------------------------------------------------------------- paso 2

const validation = computed(() => catalog.value
  ? validateRows(rawRows.value, catalog.value, { excluded: excluded.value, existingIssueIds: existingIds.value })
  : { rows: [], errors: [], skipped: [] })
const errorsByCell = computed(() => {
  const map = new Map<string, string>()
  for (const e of validation.value.errors) map.set(`${e.line}:${e.column}`, e.message)
  return map
})
const rowErrors = computed(() => new Set(validation.value.errors.map(e => e.line)))
const skippedLines = computed(() => new Set(validation.value.skipped.map(s => s.line)))
const included = computed(() => validation.value.rows.length)
const canImport = computed(() => included.value > 0 && validation.value.errors.length === 0)

const editing = ref<{ line: number, column: string } | null>(null)
const draft = ref('')

async function editCell(line: number, column: string): Promise<void> {
  editing.value = { line, column }
  draft.value = rawRows.value.find(r => r.line === line)?.cells[column] ?? ''
  await nextTick()
  document.querySelector<HTMLInputElement>('[data-import-editor]')?.focus()
}

function saveCell(): void {
  const cell = editing.value
  if (!cell) return
  rawRows.value = rawRows.value.map(r => r.line === cell.line ? { ...r, cells: { ...r.cells, [cell.column]: draft.value.trim() } } : r)
  editing.value = null
}

function toggleRow(line: number): void {
  const next = new Set(excluded.value)
  if (next.has(line)) next.delete(line)
  else next.add(line)
  excluded.value = next
}

function goToError(error: ImportError): void {
  void editCell(error.line, error.column || 'Asunto')
}

// --------------------------------------------------------------- paso 3

const results = ref<ItemResult[]>([])
const progress = ref({ done: 0, total: 0 })
let controller: AbortController | undefined

async function start(): Promise<void> {
  if (!canImport.value) return
  step.value = 'running'
  controller = new AbortController()
  const rows = validation.value.rows
  progress.value = { done: 0, total: rows.length }
  results.value = await runBatch(rows, async payload => (await redmine.createIssue(payload)).id, {
    signal: controller.signal,
    describeError: explainRejection,
    onProgress: done => (progress.value = { done, total: rows.length }),
  })
  step.value = 'result'
  void queryClient.invalidateQueries({ queryKey: ['issues'] })
}

function cancel(): void {
  controller?.abort()
}

// --------------------------------------------------------------- paso 4

const summary = computed(() => summarize(results.value))
const lineOf = computed(() => new Map(validation.value.rows.map(r => [r.line, r])))

async function downloadReport(): Promise<void> {
  if (!original.value) return
  downloadFile(await buildReport(original.value, results.value), reportFilename(fileName.value))
}

/** Al cerrar tras importar, la lista con "creadas por mí hoy". */
function finish(): void {
  open.value = false
  if (summary.value.created > 0) {
    toasts.show(summary.value.label)
    const f = toUrl({ conditions: [
      { field: 'author_id', operator: '=', values: ['me'] },
      { field: 'created_on', operator: '=', values: ['@today'] },
      { field: 'status_id', operator: '*', values: [] },
    ] })
    void navigateTo({ path: '/issues', query: { f } })
  }
}

/** Mientras crea no se puede cerrar: primero hay que cancelar. */
const dialogOpen = computed({
  get: () => open.value,
  set: (value: boolean) => {
    if (!value && step.value === 'running') return
    if (!value && step.value === 'result') finish()
    else open.value = value
  },
})

const title = computed(() => ({
  pick: 'Importar tareas',
  preview: `Revisar ${fileName.value}`,
  running: 'Creando tareas',
  result: 'Importación terminada',
})[step.value])
</script>

<template>
  <UiDialog
    v-model:open="dialogOpen"
    :title="title"
    :description="catalog ? `En ${catalog.project.name}` : undefined"
    :width="step === 'preview' || step === 'result' ? 64 : 32"
  >
    <!-- 1 · Elegir archivo -->
    <div
      v-if="step === 'pick'"
      class="flex flex-col gap-3"
    >
      <p
        v-if="catalogError"
        role="alert"
        class="text-warning"
      >
        No se pudo leer el proyecto: {{ explainRejection(catalogError) }}
      </p>
      <div
        class="flex flex-col items-center gap-2 rounded-[var(--radius-surface)] border-2 border-dashed p-6 text-center transition-colors"
        :class="[dragging ? 'border-content bg-fill-selected' : pickError ? 'border-warning' : 'border-separator']"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <Icon
          name="lucide:file-spreadsheet"
          class="size-8 text-secondary"
          aria-hidden="true"
        />
        <p class="text-secondary">
          Suelta aquí la plantilla rellena o
          <button
            type="button"
            class="font-medium text-content underline underline-offset-4"
            :disabled="!ready || loading"
            @click="picker?.click()"
          >
            elígela
          </button>
        </p>
        <input
          ref="picker"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          class="sr-only"
          tabindex="-1"
          aria-hidden="true"
          @change="onPick"
        >
        <p
          v-if="loading || !ready"
          class="text-[length:var(--text-caption)] text-secondary"
          aria-live="polite"
        >
          {{ loading ? 'Leyendo el archivo…' : 'Preparando el proyecto…' }}
        </p>
        <p
          v-if="pickError"
          role="alert"
          class="inline-flex items-center gap-1.5 text-warning"
        >
          <Icon
            name="lucide:circle-alert"
            class="size-4 shrink-0"
            aria-hidden="true"
          />
          {{ pickError }}
        </p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 self-start text-secondary underline underline-offset-4 hover:text-content disabled:opacity-50"
        :disabled="!ready"
        @click="downloadTemplate"
      >
        <Icon
          name="lucide:download"
          class="size-4"
          aria-hidden="true"
        />
        Descargar plantilla
      </button>
    </div>

    <!-- 2 · Revisar -->
    <div
      v-else-if="step === 'preview'"
      class="flex flex-col gap-3"
    >
      <p
        v-if="validation.skipped.length > 0"
        class="inline-flex items-center gap-1.5 text-secondary"
      >
        <Icon
          name="lucide:info"
          class="size-4"
          aria-hidden="true"
        />
        {{ validation.skipped.length }} {{ validation.skipped.length === 1 ? 'fila ya se creó' : 'filas ya se crearon' }} en una importación anterior y no se repetirán.
      </p>

      <section
        v-if="validation.errors.length > 0"
        aria-labelledby="import-errors"
        class="rounded-[var(--radius-control)] border border-warning p-3"
      >
        <h3
          id="import-errors"
          class="inline-flex items-center gap-1.5 font-semibold text-warning"
        >
          <Icon
            name="lucide:circle-alert"
            class="size-4"
            aria-hidden="true"
          />
          {{ validation.errors.length }} {{ validation.errors.length === 1 ? 'error por corregir' : 'errores por corregir' }}
        </h3>
        <ul class="mt-1 max-h-32 overflow-y-auto">
          <li
            v-for="(error, i) in validation.errors"
            :key="i"
          >
            <button
              type="button"
              class="text-left text-[length:var(--text-caption)] hover:underline"
              @click="goToError(error)"
            >
              <span class="data">Fila {{ error.line }}</span> {{ error.column ? `· ${error.column}: ` : ': ' }}{{ error.message }}
            </button>
          </li>
        </ul>
      </section>

      <div class="max-h-[46vh] overflow-auto rounded-[var(--radius-control)] border border-separator">
        <table class="w-max min-w-full border-collapse text-[length:var(--text-caption)]">
          <thead class="sticky top-0 bg-raised">
            <tr>
              <th
                scope="col"
                class="px-2 py-1.5 text-left font-medium"
              >
                Incluir
              </th>
              <th
                scope="col"
                class="px-2 py-1.5 text-left font-medium"
              >
                Excel
              </th>
              <th
                v-for="header in headers"
                :key="header"
                scope="col"
                class="whitespace-nowrap px-2 py-1.5 text-left font-medium"
              >
                {{ header }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rawRows"
              :key="row.line"
              class="border-t border-separator"
              :class="excluded.has(row.line) || skippedLines.has(row.line) ? 'text-tertiary' : ''"
            >
              <td class="px-2 py-1">
                <input
                  type="checkbox"
                  :checked="!excluded.has(row.line) && !skippedLines.has(row.line)"
                  :disabled="skippedLines.has(row.line)"
                  :aria-label="`Incluir la fila ${row.line}`"
                  @change="toggleRow(row.line)"
                >
              </td>
              <td class="data px-2 py-1 text-secondary">
                <span class="inline-flex items-center gap-1">
                  {{ row.line }}
                  <Icon
                    v-if="rowErrors.has(row.line)"
                    name="lucide:circle-alert"
                    class="size-3 text-warning"
                    aria-hidden="true"
                  />
                </span>
              </td>
              <td
                v-for="header in headers"
                :key="header"
                class="max-w-56 px-1 py-0.5 align-top"
                :class="errorsByCell.has(`${row.line}:${header}`) ? 'bg-warning/10' : ''"
              >
                <input
                  v-if="editing?.line === row.line && editing.column === header"
                  v-model="draft"
                  data-import-editor
                  :aria-label="`${header}, fila ${row.line}`"
                  class="min-h-7 w-48 rounded-[var(--radius-control)] border border-separator bg-surface px-1.5"
                  @keydown.enter.prevent="saveCell"
                  @keydown.esc.prevent="editing = null"
                  @blur="saveCell"
                >
                <button
                  v-else
                  type="button"
                  class="flex w-full min-w-12 flex-col items-start rounded-[var(--radius-control)] px-1 py-0.5 text-left hover:bg-fill-hover"
                  :disabled="skippedLines.has(row.line)"
                  :aria-label="`${header}, fila ${row.line}: ${row.cells[header] || 'vacío'}${errorsByCell.has(`${row.line}:${header}`) ? `. Error: ${errorsByCell.get(`${row.line}:${header}`)}` : ''}. Editar`"
                  @click="editCell(row.line, header)"
                >
                  <span class="block max-w-52 truncate">{{ row.cells[header] || '·' }}</span>
                  <span
                    v-if="errorsByCell.has(`${row.line}:${header}`)"
                    class="inline-flex items-center gap-0.5 text-warning"
                    aria-hidden="true"
                  >
                    <Icon
                      name="lucide:circle-alert"
                      class="size-3"
                    />
                    {{ errorsByCell.get(`${row.line}:${header}`) }}
                  </span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-[length:var(--text-caption)] text-secondary">
        Pulsa una celda para corregirla aquí mismo. Nada se crea hasta que confirmes.
      </p>
    </div>

    <!-- 3 · Creando -->
    <div
      v-else-if="step === 'running'"
      class="flex flex-col gap-3"
    >
      <p
        class="data text-[length:var(--text-title)] font-semibold"
        aria-live="polite"
      >
        {{ progress.done }} de {{ progress.total }}
      </p>
      <div
        class="h-2 overflow-hidden rounded-full bg-fill-selected"
        role="progressbar"
        aria-label="Tareas creadas"
        aria-valuemin="0"
        :aria-valuemax="progress.total"
        :aria-valuenow="progress.done"
      >
        <div
          class="h-full rounded-full bg-content transition-[width] duration-200"
          :style="{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }"
        />
      </div>
      <p class="text-secondary">
        Cancelar para antes de la siguiente tarea; las ya creadas se quedan.
      </p>
    </div>

    <!-- 4 · Resultado -->
    <div
      v-else
      class="flex flex-col gap-3"
    >
      <p
        class="text-[length:var(--text-title)] font-semibold"
        role="status"
      >
        {{ summary.label }}
      </p>
      <ul class="max-h-[46vh] overflow-y-auto">
        <li
          v-for="result in results"
          :key="result.line"
          class="flex items-baseline gap-2 border-t border-separator px-1 py-1.5"
        >
          <Icon
            :name="result.status === 'created' ? 'lucide:circle-check' : result.status === 'cancelled' ? 'lucide:circle-minus' : 'lucide:circle-alert'"
            class="size-4 shrink-0 self-center"
            :class="result.status === 'created' ? 'text-success' : result.status === 'cancelled' ? 'text-secondary' : 'text-warning'"
            aria-hidden="true"
          />
          <span class="data shrink-0 text-secondary">Fila {{ result.line }}</span>
          <span class="min-w-0 flex-1 truncate">{{ lineOf.get(result.line)?.cells.Asunto }}</span>
          <NuxtLink
            v-if="result.status === 'created'"
            :to="`/issues/${result.id}`"
            class="data shrink-0 hover:underline"
            @click="open = false"
          >#{{ result.id }}</NuxtLink>
          <span
            v-else
            class="shrink-0 text-[length:var(--text-caption)]"
            :class="result.status === 'cancelled' ? 'text-secondary' : 'text-warning'"
          >{{ result.status === 'cancelled' ? 'No creada: cancelado' : result.message }}</span>
        </li>
      </ul>
    </div>

    <template #footer>
      <template v-if="step === 'preview'">
        <UiButton
          label="Elegir otro archivo"
          variant="ghost"
          @click="step = 'pick'"
        />
        <UiButton
          :label="`Importar ${included} ${included === 1 ? 'tarea' : 'tareas'}`"
          variant="primary"
          :disabled="!canImport"
          @click="start"
        />
      </template>
      <UiButton
        v-else-if="step === 'running'"
        label="Cancelar importación"
        @click="cancel"
      />
      <template v-else-if="step === 'result'">
        <UiButton
          label="Descargar reporte"
          icon="lucide:download"
          @click="downloadReport"
        />
        <UiButton
          label="Cerrar"
          variant="primary"
          @click="finish"
        />
      </template>
    </template>
  </UiDialog>
</template>
