import { computed } from 'vue';
import { useTabsStore } from '../../../stores/tabs';

export function useToolbarDoc() {
  const tabs = useTabsStore();
  const isMarkdown = computed(() => tabs.activeTab?.language === 'markdown');
  const isMindmap = computed(() => tabs.activeTab?.language === 'mindmap');
  const hasViewButtons = computed(() => isMarkdown.value || isMindmap.value);
  return { isMarkdown, isMindmap, hasViewButtons };
}
