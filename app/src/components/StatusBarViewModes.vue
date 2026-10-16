<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icons.vue';
import { useSettingsStore } from '../stores/settings';
import { useTabsStore } from '../stores/tabs';
import { track } from '../lib/telemetry';
import { useI18n } from '../i18n';
import type { ViewMode } from '../types';

interface ViewModeButton {
  mode: ViewMode;
  icon: string;
  labelKey: string;
}

const BUTTONS: readonly ViewModeButton[] = [
  { mode: 'edit', icon: 'view-edit', labelKey: 'toolbar.editOnly' },
  { mode: 'split', icon: 'view-split', labelKey: 'toolbar.splitPane' },
  { mode: 'liveEdit', icon: 'view-live', labelKey: 'toolbar.liveEditMode' },
  { mode: 'preview', icon: 'view-preview', labelKey: 'toolbar.previewOnly' },
  { mode: 'reading', icon: 'view-reading', labelKey: 'toolbar.readingMode' },
];

const settings = useSettingsStore();
const tabs = useTabsStore();
const { t } = useI18n();

const isVisible = computed(() => {
  const language = tabs.activeTab?.language;
  return settings.showStatusBarViewModes && (language === 'markdown' || language === 'mindmap');
});

function select(mode: ViewMode): void {
  settings.setViewMode(mode);
  track('view_mode', { mode });
}
</script>

<template>
  <span v-if="isVisible" class="sb-views" role="group" :aria-label="t('settings.showStatusBarViewModes')">
    <button
      v-for="b in BUTTONS"
      :key="b.mode"
      type="button"
      class="sb-views__btn"
      :class="{ active: settings.viewMode === b.mode }"
      :data-mode="b.mode"
      :title="t(b.labelKey)"
      :aria-pressed="settings.viewMode === b.mode"
      @click="select(b.mode)"
    >
      <Icon :name="b.icon" />
    </button>
  </span>
</template>

<style scoped>
.sb-views {
  display: inline-flex;
  align-items: center;
  gap: 1px;
}
.sb-views__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
.sb-views__btn :deep(svg) {
  width: 13px;
  height: 13px;
}
.sb-views__btn:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--text);
}
.sb-views__btn.active {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  color: var(--accent);
}
</style>
