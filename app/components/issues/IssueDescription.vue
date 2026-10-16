<script setup lang="ts">
import type { Issue, Paginated } from '../../../shared/redmine/types'
import { useQueryClient } from '@tanstack/vue-query'
import { explainRejection } from '../../../shared/redmine/issue-actions'

/**
 * Descripción de la tarea (F3-T03): render con formato y saneado, y edición con
 * vista previa para quien puede editar la tarea (`edit_issues`, o `edit_own_issues`
 * si la creó). Guardar deja "Deshacer" en el aviso.
 */
const props = defineProps<{ issue: Issue }>()

const redmine = useRedmine()
const session = useSessionStore()
const toasts = useToastStore()
const queryClient = useQueryClient()

const description = computed(() => props.issue.description ?? '')
const canEdit = computed(() => {
  const project = props.issue.project.id
  return session.can('edit_issues', project) || (props.issue.author.id === session.user?.id && session.can('edit_own_issues', project))
})

const editing = ref(false)
const draft = ref('')
const saving = ref(false)

function edit(): void {
  draft.value = description.value
  editing.value = true
}

type Detail = { pages: Paginated<Issue>[] }
const key = computed(() => ['issues', 'detail', props.issue.id])

/** Pinta el texto en la caché del detalle al momento. */
function paint(value: string): void {
  queryClient.setQueryData<Detail>(key.value, data => data && {
    ...data,
    pages: data.pages.map(page => ({ ...page, items: page.items.map(item => item.id === props.issue.id ? { ...item, description: value } : item) })),
  })
}

async function write(value: string, before: string): Promise<boolean> {
  paint(value)
  try {
    await redmine.updateIssue(props.issue.id, { description: value })
    return true
  }
  catch (error) {
    paint(before)
    toasts.show(`No se pudo guardar la descripción: ${explainRejection(error)}`)
    return false
  }
  finally {
    void queryClient.invalidateQueries({ queryKey: key.value })
  }
}

async function save(): Promise<void> {
  const before = description.value
  if (draft.value === before) {
    editing.value = false
    return
  }
  saving.value = true
  const ok = await write(draft.value, before)
  saving.value = false
  if (!ok) return
  editing.value = false
  toasts.show('Descripción guardada', { label: 'Deshacer', run: () => void write(before, draft.value) })
}
</script>

<template>
  <UiPanel label="Descripción">
    <template #header>
      <h2 class="panel-label !text-content">
        Descripción
      </h2>
      <UiButton
        v-if="canEdit && !editing"
        label="Editar descripción"
        icon="lucide:pencil"
        icon-only
        variant="ghost"
        class="ml-auto"
        @click="edit"
      />
    </template>

    <div class="px-4 pb-4">
      <TextRichTextEditor
        v-if="editing"
        v-model="draft"
        label="Descripción"
        save-label="Guardar descripción"
        :saving="saving"
        @save="save"
        @cancel="editing = false"
      />
      <TextRichText
        v-else-if="description.trim()"
        :text="description"
      />
      <p
        v-else
        class="text-secondary"
      >
        Sin descripción.
        <button
          v-if="canEdit"
          type="button"
          class="underline underline-offset-4 hover:text-content"
          @click="edit"
        >
          Añadir descripción
        </button>
      </p>
    </div>
  </UiPanel>
</template>
