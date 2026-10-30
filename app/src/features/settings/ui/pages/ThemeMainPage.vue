<script setup lang="ts">
import { useI18n } from '../../../../i18n';
import { useSettingsStore } from '../../../../stores/settings';
import type { Appearance } from '../../../../lib/theme/migrate';
import { useSettingsPanelContext } from '../../internal/useSettingsPanelContext.ts';
import { useThemeSlots } from '../../internal/useThemeSlots.ts';

const { t } = useI18n();
const settings = useSettingsStore();
const { close, openThemeMarketplace } = useSettingsPanelContext();
const { SLOT_MODES, themeStore, slotGroups, currentSlotValue, onSlot, importThemeFile, openThemeStudio } = useThemeSlots(close);
</script>

<template>
  <section data-cat="theme" data-page="theme/main">
    <p class="setting-hint">{{ t('themeStudio.pageIntro') }}</p>
    <button type="button" class="hint-btn" @click="openThemeStudio">🎨 {{ t('themeStudio.openInTab') }}</button>
  </section>

  <section data-cat="theme" data-page="theme/main">
    <label>{{ t('settings.appearance') }}</label>
    <select :value="settings.appearance" @change="settings.setAppearance(($event.target as HTMLSelectElement).value as Appearance)">
      <option value="light">{{ t('settings.appearanceLight') }}</option>
      <option value="dark">{{ t('settings.appearanceDark') }}</option>
      <option value="system">{{ t('settings.appearanceSystem') }}</option>
    </select>
    <template v-for="slot in SLOT_MODES" :key="slot.mode">
      <label>{{ t(slot.labelKey) }}</label>
      <select :value="currentSlotValue(slot.mode)" @change="onSlot(slot.mode, ($event.target as HTMLSelectElement).value)">
        <optgroup v-for="g in slotGroups(slot.mode)" :key="g.label" :label="g.label">
          <option v-for="o in g.options" :key="o.value" :value="o.value">{{ o.label }}</option>
        </optgroup>
      </select>
    </template>
  </section>

  <section data-cat="theme" data-page="theme/main">
    <label>{{ t('settings.importTheme') }}</label>
    <div class="row" style="gap: 8px; align-items: center; flex-wrap: wrap;">
      <button @click="importThemeFile">{{ t('settings.importThemeBtn') }}</button>
      <button @click="openThemeMarketplace">{{ t('themes.browseBtn') }}</button>
    </div>
    <div v-if="themeStore.lastReport" class="setting-hint">
      {{ t('settings.importReport', { name: themeStore.lastReport.name, count: themeStore.lastReport.dropped.length }) }}
      <details v-if="themeStore.lastReport.dropped.length">
        <summary>{{ t('settings.importDropped') }}</summary>
        <code v-for="d in themeStore.lastReport.dropped" :key="d" class="dropped-rule">{{ d }}</code>
      </details>
    </div>
    <p class="setting-hint">{{ t('themes.browseHint') }}</p>
  </section>
</template>

<style scoped src="../settings-page.css"></style>
