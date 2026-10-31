import { computed, type ComputedRef } from 'vue';
import { useSettingsStore } from '../../stores/settings';
import { isTauri, hasGitBackend, isIOS } from '../../lib/platform';
import { IS_APP_STORE_BUILD } from '../../lib/app-build';
import { isGitMockActive } from '../../lib/git-pane/serviceFactory';

export function isGitPanePlatform(): boolean {
  return isTauri() && hasGitBackend() && !IS_APP_STORE_BUILD && !isIOS();
}

export function useGitPaneAvailable(): ComputedRef<boolean> {
  const settings = useSettingsStore();
  return computed(() => (isGitPanePlatform() && settings.enableGitPane) || isGitMockActive());
}
