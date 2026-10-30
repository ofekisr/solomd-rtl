import type { Tab } from '../types';
import { compactTabs, expandTabs, setItemWithEviction } from '../lib/tab-persistence';
import { sessionKey } from '../lib/cm/session-restore';
import { readStoredSetting, restoreSessionEnabled } from '../features/settings/contracts/index.ts';

interface TauriWindow {
  __TAURI_INTERNALS__?: { metadata?: { currentWindow?: { label?: unknown } } };
}

// Legacy / global key (used when per-workspace tabs is OFF, and as the
// migration source on first upgrade).
export const LS_KEY = 'solomd.tabs.v1';
// Per-workspace bucket prefix: `solomd.tabs.v1::<folder>`. Each workspace
// remembers its own open tabs, so opening folder A never dumps folder B's
// accumulated tabs, and two windows on different workspaces write distinct
// keys instead of clobbering one global blob.
const LS_BUCKET_PREFIX = 'solomd.tabs.v1::';
const NO_WORKSPACE = '__none__';

// #103 — auxiliary windows ("Open file in new window") get their own tab
// bucket so multiple windows on the same folder don't clobber each other's
// open tabs. The main window keeps the un-suffixed keys above (backward
// compatible — existing sessions restore unchanged); auxiliary windows
// append `::win::<label>`. Labels are the stable `solomd-window-N` ids the
// windows store hands out.
const AUX_LABEL_PREFIX = 'solomd-window-';

/** The current Tauri window's label, or 'main' outside Tauri (Vitest, the
 *  marketing site preview, etc.). Read lazily and defensively because tabs.ts
 *  initializes before the Tauri API is guaranteed ready. */
export function currentWindowLabel(): string {
  try {
    const internals = (window as unknown as TauriWindow).__TAURI_INTERNALS__;
    const label = internals?.metadata?.currentWindow?.label;
    if (typeof label === 'string' && label) return label;
  } catch {}
  return 'main';
}

/** Per-window scope suffix appended to a bucket key. Empty for the main
 *  window (preserves legacy keys); `::win::<label>` for auxiliary windows. */
export function windowScopeSuffix(): string {
  const label = currentWindowLabel();
  return label.startsWith(AUX_LABEL_PREFIX) ? `::win::${label}` : '';
}

export interface PersistedState {
  tabs: Tab[];
  activeId: string;
}

/** Per-workspace tab scoping. Default ON. Inlined from localStorage so it
 *  works before the settings store hydrates (loadPersisted runs at store
 *  creation). */
export function perWorkspaceTabsEnabled(): boolean {
  const stored = readStoredSetting('perWorkspaceTabs');
  return typeof stored === 'boolean' ? stored : true;
}

/** Current workspace folder, read straight from localStorage to avoid a
 *  static import cycle with the workspace store and to work at init time. */
export function currentWorkspaceFolder(): string | null {
  try {
    const raw = localStorage.getItem('solomd.workspace.v1');
    if (raw) {
      const w = JSON.parse(raw);
      if (w && typeof w.currentFolder === 'string') return w.currentFolder;
    }
  } catch {}
  return null;
}

function recentWorkspaceFolders(): string[] {
  try {
    const w = JSON.parse(localStorage.getItem('solomd.workspace.v1') || 'null');
    if (w && Array.isArray(w.recentFolders)) return w.recentFolders.filter((f: unknown) => typeof f === 'string');
  } catch {}
  return [];
}

export function writeBucket(key: string, state: PersistedState): void {
  setItemWithEviction(
    localStorage,
    key,
    JSON.stringify({ tabs: compactTabs(state.tabs), activeId: state.activeId }),
    {
      bucketPrefix: LS_BUCKET_PREFIX,
      sessionPrefix: sessionKey(''),
      recentBucketKeys: recentWorkspaceFolders().map(bucketKey),
      liveTabIds: new Set(state.tabs.map((t) => t.id)),
    },
  );
}

/** localStorage key for a workspace's tab bucket. Falls back to the single
 *  global key when per-workspace scoping is off. Auxiliary windows (#103)
 *  get a per-window suffix so they don't share a bucket with the main window
 *  or each other; the main window's keys are unchanged. */
export function bucketKey(folder: string | null): string {
  if (!perWorkspaceTabsEnabled()) return LS_KEY + windowScopeSuffix();
  return LS_BUCKET_PREFIX + (folder || NO_WORKSPACE) + windowScopeSuffix();
}

/** True when `filePath` lives inside `folder`. Separator- and (on Windows)
 *  case-insensitive so OneDrive / drive-letter paths compare correctly. */
export function inFolder(filePath: string | undefined, folder: string | null): boolean {
  if (!filePath || !folder) return false;
  const norm = (s: string) => s.replace(/\\/g, '/').replace(/\/+$/, '');
  const root = norm(folder);
  const fp = norm(filePath);
  const ci = /^[a-zA-Z]:\//.test(root);
  const r = ci ? root.toLowerCase() : root;
  const f = ci ? fp.toLowerCase() : fp;
  return f === r || f.startsWith(r + '/');
}

export function readBucket(key: string): PersistedState | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const data = JSON.parse(raw) as PersistedState;
      if (Array.isArray(data.tabs)) return { tabs: expandTabs(data.tabs), activeId: data.activeId || '' };
    }
  } catch {}
  return null;
}

export function loadPersisted(isTabDirty: (tab: Tab) => boolean): PersistedState {
  if (!restoreSessionEnabled()) return { tabs: [], activeId: '' };
  // Per-workspace OFF → behave exactly like before (single global blob).
  if (!perWorkspaceTabsEnabled()) {
    return readBucket(bucketKey(null)) ?? { tabs: [], activeId: '' };
  }
  const folder = currentWorkspaceFolder();
  const bucket = readBucket(bucketKey(folder));
  if (bucket) return bucket;
  // #103 — auxiliary windows never inherit the main window's legacy global
  // tab blob; they start from their own (possibly empty) bucket and get
  // their document via the `?path=` query param. Only the main window runs
  // the upgrade migration below.
  if (windowScopeSuffix()) return { tabs: [], activeId: '' };
  // First launch after upgrade: no bucket yet for this workspace. Seed it
  // by scoping the legacy global tab list to the current folder (plus any
  // untitled or unsaved tabs), so an upgrading user with tabs accumulated
  // across many folders doesn't get all of them dumped into this window.
  const legacy = readBucket(LS_KEY);
  if (legacy) {
    const scoped = legacy.tabs.filter(
      (t) => !t.filePath || inFolder(t.filePath, folder) || isTabDirty(t),
    );
    const activeKept = scoped.some((t) => t.id === legacy.activeId);
    return { tabs: scoped, activeId: activeKept ? legacy.activeId : scoped[0]?.id ?? '' };
  }
  return { tabs: [], activeId: '' };
}
