<script setup lang="ts">
import { useI18n } from '../../../../i18n';
import { useSettingsStore } from '../../../../stores/settings';
import { useDirectiveStatus } from '../../internal/useDirectiveStatus.ts';
import { useSettingsEnv } from '../../internal/settings-env.ts';
import { useSpellDicts } from '../../internal/useSpellDicts.ts';

const { t } = useI18n();
const settings = useSettingsStore();
const { windowsEditorRuntime } = useSettingsEnv();
const { spellDicts, refreshSpellDicts, openDictsFolder } = useSpellDicts();
const { completionStatusText, completionWarnings, openCompletionsFolder } = useDirectiveStatus();
</script>

<template>
  <section data-cat="writing" data-page="writing/aids">
    <h3 style="font-size: 13px; font-weight: 600; color: var(--text); margin: 18px 0 6px;">
      {{ t('settings.directiveCompletions') }}
    </h3>
    <button type="button" class="link-button" @click="openCompletionsFolder">
      {{ t('settings.openCompletionsFolder') }}
    </button>
    <p class="setting-hint">{{ completionStatusText }}</p>
    <p class="setting-hint">{{ t('settings.directiveCompletionRestartHint') }}</p>
    <details v-if="completionWarnings.length">
      <summary>
        {{ t('settings.directiveCompletionWarnings', { count: completionWarnings.length }) }}
      </summary>
      <ul>
        <li
          v-for="warning in completionWarnings"
          :key="`${warning.sourceFile}:${warning.reason}`"
        >
          {{ warning.sourceFile }} — {{ warning.reason }}
        </li>
      </ul>
    </details>
  </section>

  <section data-cat="writing" data-page="writing/aids">
    <label>
      <input type="checkbox" :checked="settings.spellcheckEnabled" @change="settings.toggleSpellcheckEnabled()" />
      {{ t('settings.spellcheckEnabled') }}
    </label>
    <!-- #246 — only en_US ships with the app; anything the user drops in
         `<config>/dictionaries/` shows up here. Without this the checker
         flagged every word for non-English writers. It belongs to the
         Hunspell checkbox: it used to hang off the browser spell-check
         toggle below, so ticking this box revealed nothing. -->
    <div v-if="settings.spellcheckEnabled" class="ghs-row" style="align-items:center; gap:8px; margin-top:6px;">
      <span>{{ t('settings.spellcheckLang') }}</span>
      <select
        class="ghs-select"
        :value="settings.spellcheckLang"
        @focus="refreshSpellDicts"
        @change="settings.setSpellcheckLang(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="code in spellDicts" :key="code" :value="code">{{ code }}</option>
      </select>
      <button type="button" class="link-button" @click="openDictsFolder">
        {{ t('settings.spellcheckAddDict') }}
      </button>
    </div>
    <p v-if="settings.spellcheckEnabled" class="setting-hint">{{ t('settings.spellcheckLangHint') }}</p>
  </section>

  <section data-cat="writing" data-page="writing/aids">
    <label>
      <input type="checkbox" :checked="settings.spellCheck" @change="settings.toggleSpellCheck()" />
      {{ t('settings.spellCheck') }}
    </label>
  </section>

  <section data-cat="writing" data-page="writing/aids">
    <label>
      <input type="checkbox" :checked="settings.vimMode" @change="settings.toggleVimMode()" />
      {{ t('settings.vimMode') }}
    </label>
  </section>

  <section v-if="windowsEditorRuntime" data-cat="writing" data-page="writing/aids">
    <label>{{ t('settings.windowsEditorEngine') }}</label>
    <select
      :value="settings.vimMode ? 'codemirror' : settings.windowsEditorEngine"
      :disabled="settings.vimMode"
      @change="settings.setWindowsEditorEngine(($event.target as HTMLSelectElement).value as 'native' | 'codemirror')"
    >
      <option value="native">{{ t('settings.windowsEditorEngineNative') }}</option>
      <option value="codemirror">{{ t('settings.windowsEditorEngineCodeMirror') }}</option>
    </select>
    <p class="setting-hint">
      {{ settings.vimMode ? t('settings.windowsEditorEngineVimHint') : t('settings.windowsEditorEngineHint') }}
    </p>
  </section>

  <section data-cat="writing" data-page="writing/aids">
    <label>
      <input type="checkbox" :checked="settings.slashCommandsEnabled" @change="settings.toggleSlashCommandsEnabled()" />
      {{ t('settings.slashCommandsEnabled') }}
    </label>
  </section>
</template>

<style scoped src="../settings-page.css"></style>
