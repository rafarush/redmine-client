<script setup lang="ts">
import type { ThemePreference } from '../../../shared/theme'
import {
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'

/** Cambia entre los temas disponibles: seguir al sistema, claro u oscuro. */
const preferences = usePreferencesStore()

const OPTIONS: { value: ThemePreference, label: string, icon: string }[] = [
  { value: 'system', label: 'Sistema', icon: 'lucide:monitor' },
  { value: 'light', label: 'Claro', icon: 'lucide:sun' },
  { value: 'dark', label: 'Oscuro', icon: 'lucide:moon' },
]

const current = computed(() => OPTIONS.find(o => o.value === preferences.theme) ?? OPTIONS[0]!)
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      class="inline-flex min-h-[var(--control-min)] min-w-[var(--control-min)] items-center justify-center rounded-[var(--radius-control)] text-secondary transition-colors hover:bg-fill-hover focus-visible:outline-2 focus-visible:outline-accent"
      :aria-label="`Tema: ${current.label}`"
    >
      <Icon
        :name="current.icon"
        class="size-4"
        aria-hidden="true"
      />
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent
        :class="[FLOATING_PANEL, 'min-w-40']"
        :side-offset="6"
        align="end"
      >
        <DropdownMenuRadioGroup
          :model-value="preferences.theme"
          @update:model-value="preferences.setTheme($event as ThemePreference)"
        >
          <DropdownMenuRadioItem
            v-for="option in OPTIONS"
            :key="option.value"
            :value="option.value"
            :class="MENU_ITEM"
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
            <Icon
              :name="option.icon"
              class="size-4 text-secondary"
              aria-hidden="true"
            />
            {{ option.label }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
