<script setup lang="ts">
import { useI18n } from '../../../../i18n';
import { useSettingsStore } from '../../../../stores/settings';
import { useChordHint } from '../../internal/useChordHint.ts';

const { t } = useI18n();
const settings = useSettingsStore();
const withChord = useChordHint();
</script>

<template>
  <section data-cat="writing" data-page="writing/focus">
    <h3 style="font-size: 13px; font-weight: 600; color: var(--text); margin: 18px 0 6px;">
      {{ t('writingStats.settingsHeading') }}
    </h3>
    <label>
      <input
        type="checkbox"
        :checked="settings.showWritingStats"
        @change="settings.toggleWritingStats()"
      />
      {{ t('writingStats.showInStatusBar') }}
    </label>
    <label style="margin-top: 6px;">
      <input
        type="checkbox"
        :checked="settings.showWorkspaceDailyTotal"
        @change="settings.toggleWorkspaceDailyTotal()"
        :disabled="!settings.showWritingStats"
      />
      {{ t('writingStats.showWorkspaceDailyTotal') }}
    </label>
    <p style="font-size: 11px; color: var(--text-faint); margin: 4px 0 0; line-height: 1.5;">
      {{ t('writingStats.frontMatterHint') }}
    </p>
  </section>

  <section data-cat="writing" data-page="writing/focus">
    <label>
      <input type="checkbox" :checked="settings.focusMode" @change="settings.toggleFocusMode()" />
      {{ t('settings.focusMode') }}
    </label>
    <label>
      <input type="checkbox" :checked="settings.toolbarHidden" @change="settings.toggleToolbarHidden()" />
      {{ t('settings.toolbarHidden') }}
    </label>
    <p class="setting-hint">{{ withChord('settings.toolbarHiddenHint', 'view.toggleToolbar') }}</p>
  </section>

  <section data-cat="writing" data-page="writing/focus">
    <h3 style="font-size: 13px; font-weight: 600; color: var(--text); margin: 18px 0 6px;">
      {{ t('pomodoro.settingsHeading') }}
    </h3>
    <label>
      <input
        type="checkbox"
        :checked="settings.pomodoroShowControls"
        @change="settings.togglePomodoroShowControls()"
      />
      {{ t('pomodoro.showControls') }}
    </label>
    <p style="font-size: 11px; color: var(--text-faint); margin: 4px 0 8px; line-height: 1.5;">
      {{ withChord('pomodoro.showControlsHint', 'pomodoro.startLast') }}
    </p>
    <label>
      <input
        type="checkbox"
        :checked="settings.pomodoroAutoEngageFocus"
        @change="settings.togglePomodoroAutoEngageFocus()"
      />
      {{ t('pomodoro.autoEngageFocus') }}
    </label>
    <p style="font-size: 11px; color: var(--text-faint); margin: 4px 0 8px; line-height: 1.5;">
      {{ t('pomodoro.autoEngageFocusHint') }}
    </p>
    <label style="display: block; margin-top: 4px;">{{ t('pomodoro.defaultDuration') }}</label>
    <select
      :value="String(settings.pomodoroDefaultMinutes)"
      @change="(e) => {
        const v = (e.target as HTMLSelectElement).value;
        if (v === 'custom') return;
        settings.setPomodoroDefaultMinutes(parseInt(v, 10));
      }"
      style="margin-top: 4px;"
    >
      <option value="25">25 {{ t('pomodoro.minShort') }}</option>
      <option value="50">50 {{ t('pomodoro.minShort') }}</option>
      <option value="90">90 {{ t('pomodoro.minShort') }}</option>
    </select>
    <input
      type="number"
      min="1"
      max="600"
      :value="settings.pomodoroDefaultMinutes"
      @input="settings.setPomodoroDefaultMinutes(parseInt(($event.target as HTMLInputElement).value, 10) || 25)"
      :aria-label="t('pomodoro.customDurationLabel')"
      style="margin-left: 8px; padding: 4px 6px; width: 70px; border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 4px; font: inherit;"
    />
  </section>

  <section data-cat="writing" data-page="writing/focus">
    <label>
      <input type="checkbox" :checked="settings.typewriterMode" @change="settings.toggleTypewriterMode()" />
      {{ t('settings.typewriterMode') }}
    </label>
  </section>
</template>

<style scoped src="../settings-page.css"></style>
