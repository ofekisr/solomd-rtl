import type { useTabsStore } from '../../stores/tabs';
import type { useWorkspaceStore } from '../../stores/workspace';
import type { useSettingsStore } from '../../stores/settings';
import type { useToastsStore } from '../../stores/toasts';
import type { useRecentEditsStore } from '../../stores/recentEdits';
import type { useWindowsStore } from '../../stores/windows';
import type { useI18n } from '../../i18n';
import type { useConvertedOutput } from '../useConvertedOutput';

export interface FilesCtx {
  tabs: ReturnType<typeof useTabsStore>;
  workspace: ReturnType<typeof useWorkspaceStore>;
  settings: ReturnType<typeof useSettingsStore>;
  toasts: ReturnType<typeof useToastsStore>;
  recentEdits: ReturnType<typeof useRecentEditsStore>;
  windowsStore: ReturnType<typeof useWindowsStore>;
  t: ReturnType<typeof useI18n>['t'];
  openConvertedContent: ReturnType<typeof useConvertedOutput>['openConvertedContent'];
}

export interface OpenPathOptions {
  bypassNewWindow?: boolean;
  revealInTree?: boolean;
}

export type OpenPath = (path: string, opts?: OpenPathOptions) => Promise<void>;

export type PickerStartDir = (
  ...preferred: Array<string | null | undefined>
) => Promise<string | undefined>;
