<script setup lang="ts">
import type { FormatPreference } from '../../../shared/redmine/rich-text'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'reka-ui'

/** Quién eres, contra qué Redmine, y cómo salir (F1-T08). */
const session = useSessionStore()
const preferences = usePreferencesStore()

/** Formato del texto de Redmine (F3-T03): la API no lo dice, así que se adivina o se fija aquí. */
const FORMATS: { value: FormatPreference, label: string }[] = [
  { value: 'auto', label: 'Detectar solo' },
  { value: 'textile', label: 'Textile' },
  { value: 'markdown', label: 'Markdown' },
]

/** Host sin esquema: lo que identifica la instancia de un vistazo. */
const host = computed(() => session.url.replace(/^https?:\/\//, ''))

async function disconnect(): Promise<void> {
  await session.disconnect()
  await navigateTo('/connect')
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      class="flex min-h-[var(--control-min)] w-full items-center gap-2 rounded-[var(--radius-control)] px-2 text-left transition-colors hover:bg-fill-hover"
      :aria-label="`Cuenta de ${session.name} en ${host}`"
    >
      <span
        class="data grid size-6 shrink-0 place-items-center rounded-[var(--radius-plate)] bg-board text-[10px] font-semibold text-on-board"
        aria-hidden="true"
      >{{ session.initials }}</span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-[length:var(--text-body)]">{{ session.name }}</span>
        <span class="block truncate text-[length:var(--text-caption)] text-secondary">{{ host }}</span>
      </span>
      <Icon
        name="lucide:chevrons-up-down"
        class="size-4 shrink-0 text-secondary"
        aria-hidden="true"
      />
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent
        class="ui-pop z-50 min-w-56 rounded-[var(--radius-surface)] border border-separator bg-raised p-1 shadow-popover"
        :side-offset="6"
        align="start"
      >
        <DropdownMenuItem
          as="a"
          :href="session.url"
          target="_blank"
          rel="noopener"
          class="flex min-h-[var(--control-min)] cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-2 outline-none data-[highlighted]:bg-fill-selected"
        >
          <Icon
            name="lucide:external-link"
            class="size-4"
            aria-hidden="true"
          />
          Abrir en Redmine
        </DropdownMenuItem>

        <DropdownMenuSeparator class="my-1 h-px bg-separator" />

        <DropdownMenuLabel :class="MENU_LABEL">
          Formato del texto
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          :model-value="preferences.textFormat"
          @update:model-value="preferences.setTextFormat($event as FormatPreference)"
        >
          <DropdownMenuRadioItem
            v-for="format in FORMATS"
            :key="format.value"
            :value="format.value"
            :class="MENU_ITEM"
            @select.prevent
          >
            <span class="grid size-4 place-items-center">
              <DropdownMenuItemIndicator>
                <Icon
                  name="lucide:check"
                  class="size-4"
                  aria-hidden="true"
                />
              </DropdownMenuItemIndicator>
            </span>
            {{ format.label }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator class="my-1 h-px bg-separator" />

        <DropdownMenuItem
          class="flex min-h-[var(--control-min)] cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-2 outline-none data-[highlighted]:bg-fill-selected"
          @select="disconnect"
        >
          <Icon
            name="lucide:log-out"
            class="size-4"
            aria-hidden="true"
          />
          Desconectar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
