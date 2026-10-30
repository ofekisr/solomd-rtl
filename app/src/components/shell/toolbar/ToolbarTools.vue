<script setup lang="ts">
import Icon from '../../Icons.vue';
import PomodoroPopover from '../../PomodoroPopover.vue';
import { useI18n } from '../../../i18n';
import { useSettingsStore } from '../../../stores/settings';
import { useThemeStore } from '../../../stores/theme';
import { track } from '../../../lib/telemetry';
import { openCjkProofread as onOpenCjkProofread } from './toolbar-actions.ts';
import { useInjectedDropdowns } from './useToolbarDropdowns.ts';
import { useMeasureOnUpdate } from './useToolbarOverflow.ts';
import { useToolbarTips } from './useToolbarTips.ts';

defineEmits<{
  (e: 'open-palette'): void;
  (e: 'open-settings'): void;
  (e: 'open-help'): void;
  (e: 'open-search'): void;
}>();

const { t } = useI18n();
const { tip, chord } = useToolbarTips();
const settings = useSettingsStore();
const themeStore = useThemeStore();
const { pomoOpen, togglePomo } = useInjectedDropdowns();
useMeasureOnUpdate();
</script>

<template>
  <div class="toolbar__group">
    <div class="dropdown focus-with-pomo">
      <button
        class="icon-btn"
        :disabled="settings.viewMode === 'preview'"
        @click="settings.toggleFocusMode"
        :class="{ active: settings.focusMode }"
        :title="t('toolbar.focusModeTooltip')"
      >
        <Icon name="focus" />
      </button>
      <button
        v-if="settings.pomodoroShowControls"
        class="icon-btn pomo-chevron"
        @click="togglePomo"
        :title="t('pomodoro.openMenu', { key: chord('pomodoro.startLast') || '—' })"
        aria-haspopup="dialog"
        :aria-expanded="pomoOpen"
      >
        <Icon name="chevron-down" :size="10" />
      </button>
      <PomodoroPopover :open="pomoOpen" @close="pomoOpen = false" />
    </div>
    <button
      class="icon-btn"
      :disabled="settings.viewMode === 'preview'"
      @click="settings.toggleTypewriterMode"
      :class="{ active: settings.typewriterMode }"
      :title="t('toolbar.typewriterTooltip')"
    >
      <Icon name="typewriter" />
    </button>
    <button
      class="icon-btn"
      :disabled="settings.viewMode === 'preview'"
      @click="settings.toggleSpellCheck"
      :class="{ active: settings.spellCheck }"
      :title="t('toolbar.spellCheckTooltip')"
    >
      <Icon name="spellcheck" />
    </button>
    <button
      class="icon-btn cjk-proof-btn"
      :disabled="settings.viewMode === 'preview'"
      @click="onOpenCjkProofread"
      :title="tip('toolbar.cjkProofreadTooltip', 'proofread.cjk')"
    >
      <span class="cjk-proof-glyph">中</span>
    </button>
    <span class="toolbar__divider"></span>
    <button class="icon-btn" data-phone-primary @click="$emit('open-search')" :title="tip('toolbar.searchTooltip', 'search.global')">
      <Icon name="search" />
    </button>
    <button class="icon-btn" @click="$emit('open-palette')" :title="tip('toolbar.paletteTooltip', 'palette.open')">
      <Icon name="palette" />
    </button>
    <button class="icon-btn" @click="$emit('open-help')" :title="tip('toolbar.helpTooltip', 'help.markdown')">
      <Icon name="help" />
    </button>
    <button class="icon-btn" @click="$emit('open-settings')" :title="tip('toolbar.settingsTooltip', 'settings.open')">
      <Icon name="settings" />
    </button>
    <button
      class="icon-btn"
      @click="() => { settings.toggleTheme(themeStore.mode); track('theme_changed', { theme: themeStore.active.theme.id }); }"
      :title="themeStore.mode === 'dark' ? t('toolbar.lightMode') : t('toolbar.darkMode')"
    >
      <Icon :name="themeStore.mode === 'dark' ? 'theme-light' : 'theme-dark'" />
    </button>
  </div>
</template>

<style scoped src="./toolbar-controls.css"></style>
<style scoped src="./toolbar-dropdown.css"></style>
