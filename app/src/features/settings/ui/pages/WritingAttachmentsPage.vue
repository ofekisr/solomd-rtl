<script setup lang="ts">
import { useI18n } from '../../../../i18n';
import { useSettingsStore } from '../../../../stores/settings';

const { t } = useI18n();
const settings = useSettingsStore();
</script>

<template>
  <section data-cat="writing" data-page="writing/attachments">
    <label>{{ t('settings.attachmentMode') }}</label>
    <select
      :value="settings.attachmentMode"
      @change="settings.setAttachmentMode(($event.target as HTMLSelectElement).value as 'shared' | 'per-file' | 'custom')"
    >
      <option value="shared">{{ t('settings.attachmentModeShared') }}</option>
      <option value="per-file">{{ t('settings.attachmentModePerFile') }}</option>
      <option value="custom">{{ t('settings.attachmentModeCustom') }}</option>
    </select>
    <p class="setting-hint">{{ t('settings.attachmentModeHint') }}</p>
  </section>

  <section data-cat="writing" data-page="writing/attachments" v-if="settings.attachmentMode === 'shared'">
    <label>{{ t('settings.assetsDirName') }}</label>
    <input
      type="text"
      :value="settings.assetsDirName"
      @change="settings.setAssetsDirName(($event.target as HTMLInputElement).value)"
      placeholder="_assets"
      style="padding: 6px 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 4px; font: inherit;"
    />
    <p class="setting-hint">{{ t('settings.assetsDirNameHint') }}</p>
  </section>

  <section data-cat="writing" data-page="writing/attachments" v-if="settings.attachmentMode === 'custom'">
    <label>{{ t('settings.attachmentCustomPath') }}</label>
    <input
      type="text"
      :value="settings.attachmentCustomPath"
      @change="settings.setAttachmentCustomPath(($event.target as HTMLInputElement).value)"
      placeholder="./images/${filename}/"
      style="padding: 6px 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 4px; font: inherit;"
    />
    <p class="setting-hint">{{ t('settings.attachmentCustomPathHint') }}</p>
  </section>
</template>

<style scoped src="../settings-page.css"></style>
