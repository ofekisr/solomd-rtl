import { useFiles } from './useFiles';
import { useSettingsStore } from '../stores/settings';
import { shortcutLabel } from '../lib/keybindings';
import { useI18n } from '../i18n';
import { isMacOS, isMobile, hasGitBackend } from '../lib/platform';
import { useTabsStore } from '../stores/tabs';
import { useTilesStore } from '../stores/tiles';
import { useExport } from './useExport';
import { useToastsStore } from '../stores/toasts';
import { useDailyNotes } from './useDailyNotes';
import { usePandocExport } from './usePandocExport';
import { useBasesView } from './useBasesView';
import { useInboxView } from './useInboxView';
import { useInbox } from './useInbox';
import { useSavedViews } from './useSavedViews';
import { useAutoCommit } from './useAutoCommit';
import { useGitHistoryStore } from '../stores/gitHistory';
import { useWorkspaceStore } from '../stores/workspace';
import { useGithubSyncStore } from '../stores/githubSync';
import { useGithubSync } from './useGithubSync';
import { IS_APP_STORE_BUILD } from '../lib/app-build';
import { useGitPaneAvailable } from './useGitPaneAvailable';
import { fileViewCommands } from './commands/file-view-commands.ts';
import { editorCommands } from './commands/editor-commands.ts';
import { exportCommands } from './commands/export-commands.ts';
import { workspaceCommands } from './commands/workspace-commands.ts';
import { mindmapCommandList } from './commands/mindmap-commands.ts';
import { developerCommands } from './commands/developer-commands.ts';
import type { Command, CommandCtx } from './commands/command-types.ts';

export type { Command } from './commands/command-types.ts';

export function useCommands(): Command[] {
  const files = useFiles();
  const settings = useSettingsStore();
  // #180 — the palette must show the chord that actually works today, not
  // the one that shipped: a rebound action would otherwise advertise a key
  // that now does something else.
  const mac = isMacOS();
  const kb = (actionId: string) => shortcutLabel(actionId, settings.keybindings, mac) || undefined;
  const tabs = useTabsStore();
  const tiles = useTilesStore();
  const exporter = useExport();
  const toasts = useToastsStore();
  const { t } = useI18n();
  const daily = useDailyNotes();
  const pandoc = usePandocExport();
  const bases = useBasesView();
  const inboxView = useInboxView();
  const inbox = useInbox();
  const savedViews = useSavedViews();
  const auto = useAutoCommit();
  const gh = useGitHistoryStore();
  const ws = useWorkspaceStore();
  const ghSync = useGithubSyncStore();
  const ghSyncOps = useGithubSync();

  const ctx: CommandCtx = { files, settings, kb, tabs, tiles, exporter, toasts, t, daily, pandoc, bases, inboxView, inbox, savedViews, auto, gh, ws, ghSync, ghSyncOps };

  const all: Command[] = [
    ...fileViewCommands(ctx),
    ...editorCommands(ctx),
    ...exportCommands(ctx),
    ...workspaceCommands(ctx),
  ];

  // App Store builds strip AI / Agent commands (Apple 3.1.1).
  const built = IS_APP_STORE_BUILD
    ? all.filter((c) => c.id !== 'view.toggleAgentPanel')
    : all;
  built.push(...mindmapCommandList(ctx));
  // MAS builds ship without the `devtools` Cargo feature (private WebKit API).
  if (!IS_APP_STORE_BUILD && !isMobile()) built.push(...developerCommands(ctx));

  // #230 — Android has no libgit2, so every `history.*` / `sync.*` entry would
  // resolve to a `Command … not found`. Keep them out of the palette entirely
  // rather than letting the user find a command that can only fail.
  // Quick capture is a desktop window opened by an OS-level hotkey; neither
  // half exists on a phone, so the command would only ever fail there.
  const desktopOnly = isMobile() ? built.filter((c) => c.id !== 'capture.quick') : built;
  const isGitPaneAvailable = useGitPaneAvailable().value;
  const visible = isGitPaneAvailable ? desktopOnly : desktopOnly.filter((c) => !c.id.startsWith('git.'));
  if (!hasGitBackend()) {
    return visible.filter(
      (c) => !c.id.startsWith('history.') && !c.id.startsWith('sync.'),
    );
  }
  return visible;
}
