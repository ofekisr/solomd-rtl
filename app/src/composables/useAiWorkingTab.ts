import { computed, watch, type ComputedRef, type Ref } from 'vue';
import type { Tab, ViewMode } from '../types';
import {
  expandAiWarning,
  isAiWarningMinimized,
  isAiWorking,
  keepAiWarningMinimizedForTab,
  minimizeAiWarning,
} from '../lib/ai-activity';
import { useSettingsStore } from '../stores/settings';
import { useTabsStore } from '../stores/tabs';

const AI_VIEW_MODE: ViewMode = 'preview';
const PREVIEW_LANGUAGES = new Set(['markdown', 'mindmap']);

export interface AiWorkingTab {
  isWorking: ComputedRef<boolean>;
  isMinimized: ComputedRef<boolean>;
  minimize: () => void;
  keepMinimizedForTab: () => void;
  alwaysMinimize: () => void;
  expand: () => void;
}

export function useAiWorkingTab(tab: Ref<Tab | undefined> | ComputedRef<Tab | undefined>): AiWorkingTab {
  const settings = useSettingsStore();
  const tabs = useTabsStore();
  const path = (): string | null => tab.value?.filePath ?? null;
  const isWorking = computed(() => isAiWorking(path()));
  let restoreMode: ViewMode | null = null;

  function enterPreview(): void {
    const current = tab.value;
    if (!current || !PREVIEW_LANGUAGES.has(current.language ?? '')) return;
    if (tabs.activeTab?.id !== current.id || settings.viewMode === AI_VIEW_MODE) return;
    restoreMode = settings.viewMode;
    settings.setViewMode(AI_VIEW_MODE);
  }

  function leavePreview(): void {
    const mode = restoreMode;
    restoreMode = null;
    if (mode !== null && settings.viewMode === AI_VIEW_MODE) settings.setViewMode(mode);
  }

  watch(isWorking, (working) => {
    if (working) enterPreview();
    else leavePreview();
  }, { immediate: true });

  return {
    isWorking,
    isMinimized: computed(() => isAiWarningMinimized({
      path: path(),
      tabId: tab.value?.id ?? '',
      alwaysMinimized: settings.aiWarningAlwaysMinimized,
    })),
    minimize: () => minimizeAiWarning(path()),
    keepMinimizedForTab: () => keepAiWarningMinimizedForTab(path(), tab.value?.id ?? ''),
    alwaysMinimize: () => {
      settings.setAiWarningAlwaysMinimized(true);
      minimizeAiWarning(path());
    },
    expand: () => expandAiWarning(path(), tab.value?.id ?? ''),
  };
}
