<script setup lang="ts">
import { computed } from 'vue';
import { useRightSidebar } from '../../composables/useRightSidebar';
import { useSettingsStore } from '../../stores/settings';
import { useTabsStore } from '../../stores/tabs';
import { IS_APP_STORE_BUILD } from '../../lib/app-build';
import { useI18n } from '../../i18n';

/**
 * v4.3.0 PR #75 — right-click menu of right-sidebar pane toggles. Unchecking
 * every pane hides the strip (see `ctxToggle`).
 */
const settings = useSettingsStore();
const tabs = useTabsStore();
const { t } = useI18n();
const { sidebarCtx, searchOpen, panes, ctxToggle, closeCtx } = useRightSidebar();

interface CtxItem {
  label: string;
  isOn: boolean;
  toggle: () => void;
}

const items = computed<CtxItem[]>(() => {
  const list: CtxItem[] = [
    { label: 'search', isOn: searchOpen.value, toggle: () => { searchOpen.value = !searchOpen.value; } },
    {
      label: 'outline',
      isOn: panes.outline.value,
      toggle: () => {
        if (tabs.activeTab) tabs.toggleOutline(tabs.activeTab.id);
      },
    },
    { label: 'backlinks', isOn: settings.showBacklinks, toggle: () => settings.toggleBacklinks() },
    { label: 'relationships', isOn: settings.showRelationships, toggle: () => settings.toggleRelationships() },
    { label: 'tags', isOn: settings.showTagsPanel, toggle: () => settings.toggleTagsPanel() },
    { label: 'tasks', isOn: settings.showTasksPanel, toggle: () => settings.toggleTasksPanel() },
    { label: 'neighborhood', isOn: settings.showNeighborhood, toggle: () => settings.toggleNeighborhood() },
    { label: 'types', isOn: settings.showTypesPanel, toggle: () => settings.toggleTypesPanel() },
    { label: 'history', isOn: settings.showHistoryPanel, toggle: () => settings.toggleHistoryPanel() },
  ];
  if (!IS_APP_STORE_BUILD) {
    list.push({ label: 'agent', isOn: settings.showAgentPanel, toggle: () => settings.toggleAgentPanel() });
  }
  return list;
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="sidebarCtx"
      class="sidebar-ctx"
      :style="{ left: sidebarCtx.x + 'px', top: sidebarCtx.y + 'px' }"
      @click.stop
    >
      <label v-for="item in items" :key="item.label" class="sidebar-ctx__item" @click="ctxToggle(item.toggle)">
        <span class="sidebar-ctx__check">{{ item.isOn ? '✓' : '' }}</span>
        {{ t(`rsPane.${item.label}`) }}
      </label>
    </div>
    <div v-if="sidebarCtx" class="sidebar-ctx__backdrop" @click="closeCtx" />
  </Teleport>
</template>

<style scoped>
.sidebar-ctx {
  position: fixed;
  z-index: 9999;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px 0;
  min-width: 160px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  font-size: 13px;
  user-select: none;
}
.sidebar-ctx__item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 12px;
  text-align: left;
  background: none;
  border: none;
  color: var(--text);
  cursor: pointer;
  font: inherit;
  box-sizing: border-box;
}
.sidebar-ctx__item:hover {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}
.sidebar-ctx__check {
  display: inline-block;
  width: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--accent);
  flex-shrink: 0;
}
.sidebar-ctx__backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998;
}
</style>
