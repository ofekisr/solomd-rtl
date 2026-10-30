<script setup lang="ts">
import { useI18n } from '../../../../i18n';
import { useSettingsStore } from '../../../../stores/settings';
import { MAX_AUTO_SAVE_DELAY_MS, MIN_AUTO_SAVE_DELAY_MS } from '../../../../lib/auto-save';
import type { ConvertConflictSetting } from '../../../../lib/convert-conflict';
import { useSettingsEnv } from '../../internal/settings-env.ts';
import { useUpdateCheck } from '../../internal/useUpdateCheck.ts';

const { t } = useI18n();
const settings = useSettingsStore();
const { isMobilePlatform } = useSettingsEnv();
const { settingDefault, setAsDefault } = useUpdateCheck();
</script>

<template>
  <section data-cat="advanced" data-page="advanced/files">
    <label>
      <input type="checkbox" :checked="settings.autoReloadExternalChanges" @change="settings.toggleAutoReloadExternalChanges()" />
      {{ t('settings.autoReloadExternalChanges') }}
    </label>
    <div style="font-size: 11px; color: var(--text-faint); margin-top: 4px; line-height: 1.5;">
      {{ t('settings.autoReloadExternalChangesHint') }}
    </div>
  </section>

  <section data-cat="advanced" data-page="advanced/files">
    <label>
      {{ t('settings.convertConflict') }}
      <select
        :value="settings.convertConflictChoice"
        @change="settings.setConvertConflictChoice(($event.target as HTMLSelectElement).value as ConvertConflictSetting)"
      >
        <option value="ask">{{ t('settings.convertConflictAsk') }}</option>
        <option value="replace">{{ t('settings.convertConflictReplace') }}</option>
        <option value="keep">{{ t('settings.convertConflictKeep') }}</option>
      </select>
    </label>
    <div style="font-size: 11px; color: var(--text-faint); margin-top: 4px; line-height: 1.5;">
      {{ t('settings.convertConflictHint') }}
    </div>
  </section>

  <section data-cat="advanced" data-page="advanced/files">
    <label>
      <input type="checkbox" :checked="settings.autoSaveAfterDelay" @change="settings.toggleAutoSaveAfterDelay()" />
      {{ t('settings.autoSaveAfterDelay') }}
    </label>
    <label style="margin-top: 6px;">
      {{ t('settings.autoSaveDelay') }}
      <input
        type="number"
        :min="MIN_AUTO_SAVE_DELAY_MS"
        :max="MAX_AUTO_SAVE_DELAY_MS"
        step="100"
        style="width: 90px;"
        :value="settings.autoSaveDelayMs"
        :disabled="!settings.autoSaveAfterDelay"
        @change="settings.setAutoSaveDelayMs(Number(($event.target as HTMLInputElement).value))"
      />
      ms
    </label>
    <div style="font-size: 11px; color: var(--text-faint); margin-top: 4px; line-height: 1.5;">
      {{ t('settings.autoSaveAfterDelayHint') }}
    </div>
  </section>

  <section data-cat="advanced" data-page="advanced/files">
    <label>
      <input type="checkbox" :checked="settings.autoSaveOnBlur" @change="settings.toggleAutoSaveOnBlur()" />
      {{ t('settings.autoSaveOnBlur') }}
    </label>
    <div style="font-size: 11px; color: var(--text-faint); margin-top: 4px; line-height: 1.5;">
      {{ t('settings.autoSaveOnBlurHint') }}
    </div>
  </section>

  <section v-if="!isMobilePlatform" data-cat="advanced" data-page="advanced/files">
    <label>
      <input type="checkbox" :checked="settings.openFileInNewWindow" @change="settings.toggleOpenFileInNewWindow()" />
      {{ t('settings.openFileInNewWindow') }}
    </label>
    <div style="font-size: 11px; color: var(--text-faint); margin-top: 4px; line-height: 1.5;">
      {{ t('settings.openFileInNewWindowHint') }}
    </div>
  </section>

  <section data-cat="advanced" data-page="advanced/files">
    <label>
      <input type="checkbox" :checked="settings.revealInFileTreeOnOpen" @change="settings.toggleRevealInFileTreeOnOpen()" />
      {{ t('settings.revealInFileTreeOnOpen') }}
    </label>
    <div style="font-size: 11px; color: var(--text-faint); margin-top: 4px; line-height: 1.5;">
      {{ t('settings.revealInFileTreeOnOpenHint') }}
    </div>
  </section>

  <section data-cat="advanced" data-page="advanced/files">
    <label>
      <input type="checkbox" :checked="settings.openLinkedFilesExternally" @change="settings.toggleOpenLinkedFilesExternally()" />
      {{ t('settings.openLinkedFilesExternally') }}
    </label>
    <div style="font-size: 11px; color: var(--text-faint); margin-top: 4px; line-height: 1.5;">
      {{ t('settings.openLinkedFilesExternallyHint') }}
    </div>
  </section>

  <section data-cat="advanced" data-page="advanced/files">
    <label>{{ t('settings.fileAssoc') }}</label>
    <div class="row" style="gap: 8px; align-items: center;">
      <button
        class="primary-btn"
        :disabled="settingDefault"
        @click="setAsDefault"
      >
        {{ settingDefault ? t('settings.settingDefault') : t('settings.setDefault') }}
      </button>
    </div>
    <div style="font-size: 11px; color: var(--text-faint); margin-top: 6px; line-height: 1.5;">
      {{ t('settings.setDefaultHint') }}
    </div>
  </section>
</template>

<style scoped src="../settings-page.css"></style>
