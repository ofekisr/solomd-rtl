<script setup lang="ts">
import Icon from '../../Icons.vue';
import { useI18n } from '../../../i18n';
import { useSettingsStore } from '../../../stores/settings';
import { track } from '../../../lib/telemetry';
import { useMeasureOnUpdate } from './useToolbarOverflow.ts';
import { useToolbarDoc } from './useToolbarDoc.ts';
import { useToolbarTips } from './useToolbarTips.ts';

const { t } = useI18n();
const { tip } = useToolbarTips();
const settings = useSettingsStore();
const { isMarkdown, isMindmap } = useToolbarDoc();
useMeasureOnUpdate();
</script>

<template>
  <div class="toolbar__group">
    <button
      class="icon-btn"
      data-phone-primary
      @click="() => { settings.setViewMode('edit'); track('view_mode', { mode: 'edit' }); }"
      :class="{ active: settings.viewMode === 'edit' }"
      :title="t('toolbar.editOnly')"
    >
      <Icon name="view-edit" />
    </button>
    <button
      class="icon-btn"
      data-phone-primary
      @click="() => { settings.setViewMode('liveEdit'); track('view_mode', { mode: 'liveEdit' }); }"
      :class="{ active: settings.viewMode === 'liveEdit' }"
      :title="t('toolbar.liveEditMode')"
    >
      <Icon name="view-live" />
    </button>
    <button
      class="icon-btn"
      data-phone-primary
      @click="() => { settings.setViewMode('preview'); track('view_mode', { mode: 'preview' }); }"
      :class="{ active: settings.viewMode === 'preview' }"
      :title="t('toolbar.previewOnly')"
    >
      <Icon name="view-preview" />
    </button>
    <button
      class="icon-btn"
      @click="() => { settings.setViewMode('split'); track('view_mode', { mode: 'split' }); }"
      :class="{ active: settings.viewMode === 'split' }"
      :title="tip('toolbar.splitPane', 'view.cycleView')"
    >
      <Icon name="view-split" />
    </button>
    <button
      class="icon-btn"
      @click="() => { settings.setViewMode('reading'); track('view_mode', { mode: 'reading' }); }"
      :class="{ active: settings.viewMode === 'reading' }"
      :title="tip('toolbar.readingMode', 'view.toggleReading')"
    >
      <Icon name="view-reading" />
    </button>
    <span
      class="toolbar__divider"
      v-if="settings.viewMode !== 'preview' && settings.viewMode !== 'liveEdit'"
    ></span>
    <button
      v-if="settings.viewMode !== 'preview' && settings.viewMode !== 'liveEdit'"
      class="icon-btn"
      :disabled="isMindmap"
      @click="() => { settings.toggleLivePreview(); track('live_preview_toggled', { on: settings.livePreview ? 1 : 0 }); }"
      :class="{ active: settings.livePreview }"
      :title="settings.livePreview ? t('toolbar.livePreviewOn') : t('toolbar.livePreviewOff')"
    >
      <Icon :name="settings.livePreview ? 'live' : 'source'" />
    </button>
    <button
      v-if="isMarkdown && (settings.viewMode === 'split' || settings.viewMode === 'preview' || settings.viewMode === 'reading')"
      class="icon-btn"
      @click="settings.togglePreviewFitWidth"
      :class="{ active: settings.previewFitWidth }"
      :title="t('toolbar.fitWidthTooltip')"
    >
      <Icon name="fit-width" />
    </button>
  </div>
</template>

<style scoped src="./toolbar-controls.css"></style>
