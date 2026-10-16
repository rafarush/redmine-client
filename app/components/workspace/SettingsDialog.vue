<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

/**
 * Ajustes del workspace (F2c-T06, F2c-T12): un diálogo grande dividido en
 * categorías. Se abre en la última que se usó; el aviso de "elige el estado"
 * lo abre en Integración con Redmine.
 */
const open = defineModel<boolean>('open', { default: false })
const tab = useState<'redmine' | 'shortcuts'>('workspace-settings-tab', () => 'redmine')

const CATEGORIES = [
  { value: 'redmine', label: 'Integración con Redmine', icon: 'lucide:plug' },
  { value: 'shortcuts', label: 'Atajos de teclado', icon: 'lucide:keyboard' },
] as const
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Ajustes del workspace"
    description="Cómo se conecta con Redmine y cómo se maneja con el teclado."
    :width="46"
  >
    <TabsRoot
      v-model="tab"
      orientation="vertical"
      class="flex flex-col gap-4 wide:flex-row"
    >
      <TabsList
        aria-label="Categorías de ajustes"
        class="flex shrink-0 gap-1 overflow-x-auto wide:w-48 wide:flex-col"
      >
        <TabsTrigger
          v-for="category in CATEGORIES"
          :key="category.value"
          :value="category.value"
          class="flex min-h-[var(--control-min)] shrink-0 items-center gap-2 rounded-[var(--radius-control)] px-2.5 text-left text-secondary outline-none hover:bg-fill-hover focus-visible:ring-2 focus-visible:ring-accent data-[state=active]:bg-fill-selected data-[state=active]:font-semibold data-[state=active]:text-content"
        >
          <Icon
            :name="category.icon"
            class="size-4 shrink-0"
            aria-hidden="true"
          />
          {{ category.label }}
        </TabsTrigger>
      </TabsList>

      <div class="min-w-0 flex-1">
        <TabsContent value="redmine">
          <WorkspaceSettingsRedmineSection />
        </TabsContent>
        <TabsContent value="shortcuts">
          <WorkspaceSettingsShortcutsSection />
        </TabsContent>
      </div>
    </TabsRoot>
  </UiDialog>
</template>
