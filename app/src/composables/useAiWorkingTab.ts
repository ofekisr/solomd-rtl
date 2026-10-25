import { computed, watch, type ComputedRef, type Ref } from 'vue';
import type { Tab, ViewMode } from '../types';
import { dismissAiWarning, isAiWarningVisible, isAiWorking } from '../lib/ai-activity';
import { useSettingsStore } from '../stores/settings';
import { useTabsStore } from '../stores/tabs';

const AI_VIEW_MODE: ViewMode = 'preview';

export interface AiWorkingTab {
  isWorking: ComputedRef<boolean>;
  isBannerVisible: ComputedRef<boolean>;
  dismiss: () => void;
}

export function useAiWorkingTab(tab: Ref<Tab> | ComputedRef<Tab>): AiWorkingTab {
  const settings = useSettingsStore();
  const tabs = useTabsStore();
  const isWorking = computed(() => isAiWorking(tab.value.filePath));
  let restoreMode: ViewMode | null = null;

  function enterPreview(): void {
    if (tabs.activeTab?.id !== tab.value.id || settings.viewMode === AI_VIEW_MODE) return;
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
    isBannerVisible: computed(() => isAiWarningVisible(tab.value.filePath)),
    dismiss: () => dismissAiWarning(tab.value.filePath),
  };
}
