<script setup lang="ts">
import { useI18n } from '../../../../i18n';
import { useSettingsStore } from '../../../../stores/settings';

const { t } = useI18n();
const settings = useSettingsStore();
</script>

<template>
  <section data-cat="advanced" data-page="advanced/startup">
    <label>
      <input type="checkbox" :checked="settings.restoreSession" @change="settings.toggleRestoreSession()" />
      {{ t('settings.restoreSession') }}
    </label>
    <div style="font-size: 11px; color: var(--text-faint); margin-top: 4px; line-height: 1.5;">
      {{ t('settings.restoreSessionHint') }}
    </div>
  </section>

  <section data-cat="advanced" data-page="advanced/startup">
    <label>{{ t('settings.startupViewMode') }}</label>
    <select
      :value="settings.startupViewMode ?? ''"
      @change="settings.setStartupViewMode((($event.target as HTMLSelectElement).value || null) as any)"
    >
      <option value="">{{ t('settings.startupViewModeLastUsed') }}</option>
      <option value="edit">Edit</option>
      <option value="liveEdit">Live edit</option>
      <option value="split">Split</option>
      <option value="preview">Preview</option>
      <option value="reading">Reading</option>
    </select>
    <p class="setting-hint">{{ t('settings.startupViewModeHint') }}</p>
  </section>

  <section data-cat="advanced" data-page="advanced/startup">
    <label>
      <input type="checkbox" :checked="settings.perWorkspaceTabs" @change="settings.togglePerWorkspaceTabs()" />
      {{ t('settings.perWorkspaceTabs') }}
    </label>
    <div style="font-size: 11px; color: var(--text-faint); margin-top: 4px; line-height: 1.5;">
      {{ t('settings.perWorkspaceTabsHint') }}
    </div>
  </section>
</template>

<style scoped src="../settings-page.css"></style>
