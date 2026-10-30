import { z } from 'zod';
import { DEFAULT_AUTO_SAVE_DELAY_MS, clampAutoSaveDelay } from '../../../../lib/auto-save.ts';
import type { ConvertConflictSetting } from '../../../../lib/convert-conflict.ts';
import { DEFAULT_CONVERT_CONFLICT_SETTING, normalizeConvertConflictSetting } from '../../../../lib/convert-conflict.ts';
import { migrateLensKeybindings } from '../../../../lib/mindmap-lens.ts';
import type { ViewMode } from '../../../../types.ts';
import type { SettingsSlice } from '../../contracts/index.ts';

export type AppSettings = {
  viewMode: ViewMode;
  // #87(3) — if set, this view mode is forced on every launch, overriding
  // the persisted last-used `viewMode`. `null` (default) keeps the existing
  // behavior of resuming whatever mode the user left in.
  startupViewMode: ViewMode | null;
  /** v4.3.x release marker: set on first launch after the default flipped
   *  from `false` → `true` (desktop). If absent on load, `load()` force-enables
   *  `showFileTree` once for desktop users so the flip actually reaches the
   *  existing install base; mobile is left alone (file tree on a phone would
   *  crowd the editor). After the migration the user is free to toggle it
   *  off via the toolbar / ⌘B / command palette and the choice persists. */
  fileTreeDefaultDesktopMigrated: boolean;
  /** #143 (4.8.10) — one-time sync of a stale `previewFontSize`. The #133 fix
   *  only synced preview size when the slider was MOVED again, so installs
   *  whose `fontSize` predates 4.8.0 kept the old preview default (15) forever
   *  — "font size doesn't apply to the preview". On first load after upgrade,
   *  a previewFontSize still at the old default is aligned to fontSize once;
   *  the ⌃⌘+/− preview-zoom axis can still diverge it afterwards. */
  v4810PreviewFontSynced: boolean;
  // #148 (mobile) — one-time: hide the right sidebar on phones so the editor
  // isn't squeezed into an unreadable sliver.
  v491MobileLayoutMigrated: boolean;
  autoCheckUpdate: boolean;
  // Anonymous telemetry (Aptabase). Defaults true but user can opt out.
  telemetryEnabled: boolean;
  // First-run banner dismissal. Shown once, never again.
  telemetryNoticeAck: boolean;
  // Restore previously-open tabs + pane layout at startup (default: true).
  restoreSession: boolean;
  // Scope open tabs to the active workspace folder (default: true). Each
  // folder remembers its own tabs, so opening folder A never resurfaces
  // folder B's accumulated tabs, and multiple windows on different folders
  // don't clobber one shared tab blob. Unsaved + untitled tabs always follow
  // the user across workspaces so no in-progress work is lost.
  perWorkspaceTabs: boolean;
  // When a file watched by SoloMD is modified by another program (other
  // editor, git checkout, sync client), reload the buffer automatically
  // if the tab has no unsaved changes. Default on. Dirty tabs always
  // show the reload/overwrite/cancel dialog regardless of this setting —
  // we never silently throw away the user's in-progress edits.
  autoReloadExternalChanges: boolean;
  // When the app window loses focus (user switches to another app/window),
  // silently save every dirty tab that's already backed by a file. Untitled
  // tabs are skipped — they'd otherwise pop a Save-As dialog on blur. Default
  // off so the explicit-⌘S mental model stays the default.
  autoSaveOnBlur: boolean;
  autoSaveAfterDelay: boolean;
  autoSaveDelayMs: number;
  convertConflictChoice: ConvertConflictSetting;
  // Opening a file from the toolbar/menu spawns a new Tauri window instead
  // of a new tab in the current window. Default off.
  openFileInNewWindow: boolean;
  // After opening a file, point the file tree sidebar at its parent folder
  // (and reveal the sidebar if hidden). Default off.
  revealInFileTreeOnOpen: boolean;
  // Clicking a Markdown link to a local NON-document file (e.g.
  // `[x](./report.pdf)`) opens it with the OS default app (Typora/Obsidian
  // style) instead of converting it to Markdown via markitdown. Applies to
  // links only (file-tree double-click keeps converting). Default on — a
  // link click reads as "open this file". Turn off to convert instead.
  openLinkedFilesExternally: boolean;
  // First-launch welcome tour: opened automatically once. Don't reopen.
  welcomeShown: boolean;
  // v4.0 release migration marker: set on first launch after upgrading
  // to v4.0. If absent or false, `load()` force-enables `showAgentPanel`
  // once so users coming from v3.6.x or any v4-beta build (where the
  // default was false) actually see the marquee feature instead of an
  // unchanged sidebar. After the migration the user is free to toggle
  // it off via the command palette and the choice sticks.
  v4AgentPanelMigrated: boolean;
  // v2.4: last view mode the user was in before they entered reading mode.
  // Persisted so Esc / the close-button restores their previous workspace
  // even across reloads. Never set to 'reading' — sentinel only.
  lastNonReadingViewMode: ViewMode;
  /** #180 — per-action shortcut overrides. Only what the user changed is
   *  stored; a `null` value means they unbound the action entirely. */
  keybindings: Record<string, string | null>;
  // #251 — `c4ca303` (#216) flipped the *default* to false, but `load()` does
  // `{...defaults(), ...parsed}`, so every install that already had `true`
  // saved kept it. Those users went on seeing U+2019 drawn fullwidth by a CJK
  // font fallback and reported the same "space after the apostrophe" bug
  // again. One-time marker that turns it off once for them.
  smartQuotesOptInMigrated: boolean;
};

const VIEW_MODE_SCHEMA = z.enum(['edit', 'preview', 'split', 'liveEdit', 'reading']);

const schema = z.object({
  viewMode: VIEW_MODE_SCHEMA,
  startupViewMode: VIEW_MODE_SCHEMA.nullable(),
  fileTreeDefaultDesktopMigrated: z.boolean(),
  v4810PreviewFontSynced: z.boolean(),
  v491MobileLayoutMigrated: z.boolean(),
  autoCheckUpdate: z.boolean(),
  telemetryEnabled: z.boolean(),
  telemetryNoticeAck: z.boolean(),
  restoreSession: z.boolean(),
  perWorkspaceTabs: z.boolean(),
  autoReloadExternalChanges: z.boolean(),
  autoSaveOnBlur: z.boolean(),
  autoSaveAfterDelay: z.boolean(),
  autoSaveDelayMs: z.number(),
  convertConflictChoice: z.custom<ConvertConflictSetting>(),
  openFileInNewWindow: z.boolean(),
  revealInFileTreeOnOpen: z.boolean(),
  openLinkedFilesExternally: z.boolean(),
  welcomeShown: z.boolean(),
  v4AgentPanelMigrated: z.boolean(),
  lastNonReadingViewMode: VIEW_MODE_SCHEMA,
  keybindings: z.record(z.string(), z.string().nullable()),
  smartQuotesOptInMigrated: z.boolean(),
});

function defaults(): AppSettings {
  return {
    viewMode: 'edit',
    startupViewMode: null,
    // Fresh installs already see the new default — mark migration done so
    // load()'s one-time force-on path is a no-op for them.
    fileTreeDefaultDesktopMigrated: true,
    v4810PreviewFontSynced: true,
    v491MobileLayoutMigrated: true,
    autoCheckUpdate: true,
    telemetryEnabled: false,
    telemetryNoticeAck: true,
    restoreSession: true,
    perWorkspaceTabs: true,
    autoReloadExternalChanges: true,
    autoSaveOnBlur: false,
    autoSaveAfterDelay: true,
    autoSaveDelayMs: DEFAULT_AUTO_SAVE_DELAY_MS,
    convertConflictChoice: DEFAULT_CONVERT_CONFLICT_SETTING,
    openFileInNewWindow: false,
    revealInFileTreeOnOpen: false,
    openLinkedFilesExternally: true,
    welcomeShown: false,
    // True for fresh installs (defaults are already v4.0). Existing
    // localStorage blobs from v3.6.x / v4-beta won't have this key, so
    // `load()`'s migration kicks in and force-enables the Agent Panel
    // once before setting the marker on disk.
    v4AgentPanelMigrated: true,
    lastNonReadingViewMode: 'edit',
    keybindings: {},
    smartQuotesOptInMigrated: true,
  };
}

export const appSlice: SettingsSlice<AppSettings> = {
  id: 'app',
  schema,
  defaults,
  normalize(parsed, merged) {
    merged.autoSaveDelayMs = clampAutoSaveDelay(parsed.autoSaveDelayMs);
    merged.convertConflictChoice = normalizeConvertConflictSetting(parsed.convertConflictChoice);
    // #180 — keybindings is a free-form map, so a tampered or older blob
    // could put anything here; keep only string/null values.
    merged.keybindings = {};
    if (parsed.keybindings && typeof parsed.keybindings === 'object') {
      for (const [k, v] of Object.entries(parsed.keybindings as Record<string, unknown>)) {
        if (v === null || typeof v === 'string') merged.keybindings[k] = v;
      }
    }
    merged.keybindings = migrateLensKeybindings(merged.keybindings);
  },
};
