import type { useFiles } from '../useFiles';
import type { useExport } from '../useExport';
import type { useDailyNotes } from '../useDailyNotes';
import type { usePandocExport } from '../usePandocExport';
import type { useBasesView } from '../useBasesView';
import type { useInboxView } from '../useInboxView';
import type { useInbox } from '../useInbox';
import type { useSavedViews } from '../useSavedViews';
import type { useAutoCommit } from '../useAutoCommit';
import type { useGithubSync } from '../git/useGithubSync';
import type { useSettingsStore } from '../../stores/settings';
import type { useTabsStore } from '../../stores/tabs';
import type { useTilesStore } from '../../stores/tiles';
import type { useToastsStore } from '../../stores/toasts';
import type { useGitHistoryStore } from '../../stores/gitHistory';
import type { useWorkspaceStore } from '../../stores/workspace';
import type { useGithubSyncStore } from '../../stores/githubSync';
import type { useI18n } from '../../i18n';

export interface Command {
  id: string;
  title: string;
  hint?: string;
  shortcut?: string;
  run: () => void | Promise<void>;
}

export interface CommandCtx {
  files: ReturnType<typeof useFiles>;
  settings: ReturnType<typeof useSettingsStore>;
  kb: (actionId: string) => string | undefined;
  tabs: ReturnType<typeof useTabsStore>;
  tiles: ReturnType<typeof useTilesStore>;
  exporter: ReturnType<typeof useExport>;
  toasts: ReturnType<typeof useToastsStore>;
  t: ReturnType<typeof useI18n>['t'];
  daily: ReturnType<typeof useDailyNotes>;
  pandoc: ReturnType<typeof usePandocExport>;
  bases: ReturnType<typeof useBasesView>;
  inboxView: ReturnType<typeof useInboxView>;
  inbox: ReturnType<typeof useInbox>;
  savedViews: ReturnType<typeof useSavedViews>;
  auto: ReturnType<typeof useAutoCommit>;
  gh: ReturnType<typeof useGitHistoryStore>;
  ws: ReturnType<typeof useWorkspaceStore>;
  ghSync: ReturnType<typeof useGithubSyncStore>;
  ghSyncOps: ReturnType<typeof useGithubSync>;
}
