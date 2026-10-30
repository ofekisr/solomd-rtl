<script setup lang="ts">
import { useI18n } from '../../../i18n';
import { useMeasureOnUpdate } from './useToolbarOverflow.ts';
import { useInjectedDropdowns } from './useToolbarDropdowns.ts';
import { useWindowsMenubar } from './useWindowsMenubar.ts';

const { t } = useI18n();
const dropdowns = useInjectedDropdowns();
const { floatStyle } = dropdowns;
const { menubarNames, menubarOpen, menubarMenus, toggleMenubar, menubarHover, menuAction } =
  useWindowsMenubar(dropdowns);
useMeasureOnUpdate();
</script>

<template>
  <!-- Windows unified title bar: in-app File/Edit/View/Help menubar
       (replaces the removed native menu bar row). -->
  <nav class="menubar" data-no-drag>
    <button
      v-for="name in menubarNames"
      :key="name"
      class="menubar__btn"
      :class="{ active: menubarOpen === name }"
      @click="toggleMenubar(name, $event)"
      @mouseenter="menubarHover(name, $event)"
    >{{ t(`menubar.${name}`) }}</button>
    <Teleport to="body">
      <div v-if="menubarOpen" class="dropdown__menu" :style="floatStyle">
        <template v-for="(entry, i) in menubarMenus[menubarOpen]" :key="i">
          <div v-if="'sep' in entry" class="dropdown__sep"></div>
          <button
            v-else
            class="dropdown__item dropdown__item--single"
            @mousedown.prevent="menuAction(entry.id)"
          >
            <span class="dropdown__name">{{ entry.label }}</span>
            <span v-if="entry.shortcut" class="dropdown__shortcut">{{ entry.shortcut }}</span>
          </button>
        </template>
      </div>
    </Teleport>
  </nav>
</template>

<style scoped src="./menubar.css"></style>
<style scoped src="./toolbar-dropdown.css"></style>
