<script setup lang="ts">
import { computed, provide, ref } from 'vue';
import type { ViewMode } from '../../../types';
import Icon from '../../Icons.vue';
import BrandMark from '../../BrandMark.vue';
import { useTabsStore } from '../../../stores/tabs';
import { useSettingsStore } from '../../../stores/settings';
import { useViewport } from '../../../composables/useViewport';
import { track } from '../../../lib/telemetry';
import { shortcutLabel } from '../../../lib/keybindings';
import { useI18n } from '../../../i18n';
import ToolbarFileGroup from './ToolbarFileGroup.vue';
import ToolbarInsertMenu from './ToolbarInsertMenu.vue';
import ToolbarAiGroup from './ToolbarAiGroup.vue';
import ToolbarViewModes from './ToolbarViewModes.vue';
import ToolbarTools from './ToolbarTools.vue';
import WindowsMenubar from './WindowsMenubar.vue';
import WindowsCaption from './WindowsCaption.vue';
import { usePhoneSheet } from './usePhoneSheet.ts';
import { TOOLBAR_MEASURE, useToolbarOverflow } from './useToolbarOverflow.ts';
import { TOOLBAR_DROPDOWNS, useToolbarDropdowns } from './useToolbarDropdowns.ts';
import { WINDOWS_CAPTION, useWindowsCaption } from './useWindowsCaption.ts';
import { useTitleBar } from './useTitleBar.ts';
import { useToolbarDoc } from './useToolbarDoc.ts';
import { useToolbarTips } from './useToolbarTips.ts';

const { t } = useI18n();
const { tip, macChord } = useToolbarTips();

defineEmits<{
  (e: 'open-palette'): void;
  (e: 'open-settings'): void;
  (e: 'open-help'): void;
  (e: 'open-search'): void;
}>();

const tabs = useTabsStore();
const settings = useSettingsStore();
const { isNarrow } = useViewport();
const { isMarkdown, hasViewButtons } = useToolbarDoc();
const isDevBuild = import.meta.env.DEV;
const { macTitleBar, winTitleBar, hasTauriShell, onTitleBarMouseDown, onTitleBarDblClick } = useTitleBar();

const toolbarRef = ref<HTMLElement | null>(null);
const { sheetOpen, toggleSheet, onToolbarActivate } = usePhoneSheet(isNarrow);

const VIEW_MODE_META: Readonly<Record<ViewMode, { icon: string; labelKey: string }>> = {
  edit: { icon: 'view-edit', labelKey: 'toolbar.editOnly' },
  split: { icon: 'view-split', labelKey: 'toolbar.splitPane' },
  liveEdit: { icon: 'view-live', labelKey: 'toolbar.liveEditMode' },
  preview: { icon: 'view-preview', labelKey: 'toolbar.previewOnly' },
  reading: { icon: 'view-reading', labelKey: 'toolbar.readingMode' },
};

const viewCycleTitle = computed(() => {
  const label = t('toolbar.viewCycleTooltip', { mode: t(VIEW_MODE_META[settings.viewMode].labelKey) });
  const chord = shortcutLabel('view.cycleView', settings.keybindings, macChord);
  return chord ? `${label} (${chord})` : label;
});

function cycleViewFromToolbar(): void {
  settings.cycleViewMode();
  track('view_mode', { mode: settings.viewMode });
}

/** #134 — a plain mouse wheel scrolls an overflowing bar horizontally; Ctrl/Cmd+wheel stays app zoom. */
function onToolbarWheel(e: WheelEvent): void {
  if (e.ctrlKey || e.metaKey || e.deltaY === 0) return;
  const el = e.currentTarget as HTMLElement;
  if (el.scrollWidth <= el.clientWidth) return;
  el.scrollLeft += e.deltaY;
  e.preventDefault();
}

// Hook order is load-bearing: overflow, Windows caption, then dropdown listeners.
const { showMore, measureOverflow } = useToolbarOverflow(toolbarRef, sheetOpen, isNarrow);
const caption = useWindowsCaption(winTitleBar, hasTauriShell);
const dropdowns = useToolbarDropdowns(toolbarRef);
provide(TOOLBAR_MEASURE, measureOverflow);
provide(WINDOWS_CAPTION, caption);
provide(TOOLBAR_DROPDOWNS, dropdowns);
</script>

<template>
  <div
    ref="toolbarRef"
    class="toolbar"
    :class="{
      'toolbar--mac': macTitleBar,
      'toolbar--win': winTitleBar,
      'toolbar--phone-open': isNarrow && sheetOpen,
      'toolbar--sheet': sheetOpen,
      // #346 — keyboard users can drop the buttons. Ignored on a phone:
      // with no keyboard, the ⋯ sheet is the only way back to Settings.
      'toolbar--minimal': settings.toolbarHidden && !isNarrow,
      'toolbar--gone': settings.toolbarHidden && !isNarrow && !macTitleBar && !winTitleBar,
    }"
    @mousedown.capture="onTitleBarMouseDown"
    @dblclick="onTitleBarDblClick"
    @wheel="onToolbarWheel"
    @click="onToolbarActivate"
  >
    <BrandMark class="toolbar__brand" :size="22" />
    <span v-if="isDevBuild" class="toolbar__dev-badge" title="Dev build — sources load live from Vite">DEV</span>

    <WindowsMenubar v-if="winTitleBar" />

    <span
      v-if="tabs.activeTab?.fileName"
      class="toolbar__title"
      :title="tabs.activeTab?.filePath || tabs.activeTab?.fileName"
    >{{ tabs.activeTab.fileName }}</span>

    <ToolbarFileGroup />

    <span class="toolbar__divider"></span>

    <div class="toolbar__group">
      <button
        class="icon-btn"
        data-phone-primary
        @click="settings.toggleFileTree"
        :class="{ active: settings.showFileTree }"
        :title="tip('toolbar.fileTreeTooltip', 'view.toggleFileTree')"
      >
        <Icon name="sidebar" />
      </button>
      <button
        class="icon-btn"
        @click="settings.toggleRightSidebar"
        :class="{ active: !settings.rightSidebarHidden }"
        :title="tip('toolbar.rightSidebarTooltip', 'view.toggleRightSidebar')"
      >
        <Icon name="sidebar-right" />
      </button>
      <button
        v-if="hasViewButtons"
        class="icon-btn"
        data-view-cycle
        @click="cycleViewFromToolbar"
        :title="viewCycleTitle"
        :aria-label="viewCycleTitle"
      >
        <Icon :name="VIEW_MODE_META[settings.viewMode].icon" />
      </button>
    </div>

    <ToolbarInsertMenu v-if="isMarkdown" />

    <ToolbarAiGroup />

    <div class="toolbar__spacer"></div>

    <ToolbarViewModes v-if="hasViewButtons" />

    <span v-if="hasViewButtons" class="toolbar__divider"></span>

    <ToolbarTools
      @open-palette="$emit('open-palette')"
      @open-settings="$emit('open-settings')"
      @open-help="$emit('open-help')"
      @open-search="$emit('open-search')"
    />

    <!-- #168 / #282 — expand the strip into a labelled sheet. Always offered
         on a phone; on wider windows only once the row actually overflows.
         Rendered ahead of the Windows caption buttons so the two sticky
         right-hand items don't land on top of each other. -->
    <button
      v-if="showMore"
      class="icon-btn toolbar__more"
      :class="{ active: sheetOpen, 'toolbar__more--pinned': !isNarrow }"
      data-phone-primary
      data-phone-more
      :aria-expanded="sheetOpen"
      :title="sheetOpen ? t('toolbar.phoneLess') : t('toolbar.phoneMore')"
      @click="toggleSheet"
    >
      <span aria-hidden="true">{{ sheetOpen ? '✕' : '⋯' }}</span>
    </button>
    <WindowsCaption v-if="winTitleBar" />
  </div>
</template>

<style scoped src="./toolbar.css"></style>
<style scoped src="./toolbar-controls.css"></style>
