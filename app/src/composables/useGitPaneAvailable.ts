import { computed, type ComputedRef } from 'vue';
import { useSettingsStore } from '../stores/settings';
import { isTauri, hasGitBackend } from '../lib/platform';
import { isGitMockActive } from '../lib/git-pane/serviceFactory';

export function useGitPaneAvailable(): ComputedRef<boolean> {
  const settings = useSettingsStore();
  return computed(() => (isTauri() && hasGitBackend() && settings.enableGitPane) || isGitMockActive());
}
