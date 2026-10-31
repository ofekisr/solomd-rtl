import { defineStore } from 'pinia';
import { inferFileLanguage } from '../lib/file-language';
import { isVirtualLanguage } from '../lib/virtual-tabs';
import { useThemeStudio } from '../composables/theme/useThemeStudio';
import type { Language, Tab } from '../types';
import { useSettingsStore } from './settings';
import { useTilesStore } from './tiles';
import { useWritingSessionStore } from './writingSession';
import { useWindowsStore } from './windows';
import { stampGoalSetAtIfMissing } from '../composables/useWritingGoals';
import {
  bucketKey,
  currentWindowLabel,
  currentWorkspaceFolder,
  loadPersisted as loadPersistedTabs,
  perWorkspaceTabsEnabled,
  readBucket,
  windowScopeSuffix,
  writeBucket,
  type PersistedState,
} from './tabs-persist.ts';
import { fileNameFromSavedPath, mergeTabsDedup } from './tabs-helpers.ts';

export { inFolder } from './tabs-persist.ts';
import { encodeDiffPath, type DiffTabRef } from '../lib/git-pane/diffTab';
import { clampReorderIndex, togglePinned } from '../lib/tab-pin';
import { dataToggleTarget, MINDMAP_SET_LENS_EVENT, resolveTabLens, type SetLensDetail } from '../lib/mindmap/lens';

let nextId = 1;
const newId = () => `tab-${Date.now()}-${nextId++}`;

function inferLanguage(name: string): Language {
  return inferFileLanguage(name);
}

const THEME_STUDIO_TITLE = 'Theme Studio';

function isDirty(t: Tab): boolean {
  if (t.language === 'theme-studio') return useThemeStudio().isDirty.value;
  if (isVirtualLanguage(t.language)) return false;
  return t.content !== t.savedContent;
}

export const useTabsStore = defineStore('tabs', {
  state: (): PersistedState => loadPersistedTabs(isDirty),
  getters: {
    activeTab(state): Tab | undefined {
      return state.tabs.find((t) => t.id === state.activeId);
    },
    isDirty(): (id: string) => boolean {
      return (id: string) => {
        const t = this.tabs.find((x) => x.id === id);
        return !!t && isDirty(t);
      };
    },
    persistableTabs(state): Tab[] {
      return state.tabs.filter((t) => !isVirtualLanguage(t.language));
    },
  },
  actions: {
    newTab(opts?: { fileName?: string; language?: Language; importedFrom?: string }) {
      const fileName = opts?.fileName ?? 'Untitled.md';
      const language = opts?.language ?? inferLanguage(fileName);
      const settings = useSettingsStore();
      const tab: Tab = {
        id: newId(),
        fileName,
        content: '',
        savedContent: '',
        encoding: 'UTF-8',
        language,
        hadBom: false,
        showOutline: language === 'markdown' && settings.showOutline,
        ...(opts?.importedFrom ? { importedFrom: opts.importedFrom } : {}),
      };
      this.tabs.push(tab);
      this.activeId = tab.id;
      return tab;
    },
    openFromDisk(payload: {
      filePath: string;
      content: string;
      encoding: string;
      language: Language;
      hadBom: boolean;
    }) {
      const existing = this.tabs.find((t) => t.filePath === payload.filePath);
      if (existing) {
        this.activeId = existing.id;
        // #317 — and adopt what the caller just read off disk. Opening a file
        // that is already open used to only focus the tab and throw the fresh
        // read away, so a document another editor had changed kept showing the
        // stale copy with no way to refresh it from inside the app — opening
        // it again, the obvious move, did nothing. Unsaved edits are never
        // discarded: a dirty tab keeps its text and the watcher's conflict
        // dialog owns that case.
        if (existing.content === existing.savedContent) {
          this.applyDiskRead(existing.id, payload);
        }
        return existing;
      }
      const fileName = payload.filePath.split(/[\\/]/).pop() ?? 'Untitled';
      const settings = useSettingsStore();
      // CodeMirror normalizes \r\n → \n when the doc is created. Mirror
      // that normalization here so content and savedContent stay in
      // lock-step — otherwise opening a Windows-saved file makes the
      // tab "dirty" the moment any docChanged transaction fires
      // (cursor click, extension dispatch) and closing prompts to
      // save even though the user didn't edit anything.
      const lineEnding: 'lf' | 'crlf' = payload.content.includes('\r\n')
        ? 'crlf'
        : 'lf';
      const normalized =
        lineEnding === 'crlf' ? payload.content.replace(/\r\n/g, '\n') : payload.content;
      const tab: Tab = {
        id: newId(),
        filePath: payload.filePath,
        fileName,
        content: normalized,
        savedContent: normalized,
        encoding: payload.encoding,
        language: payload.language,
        hadBom: payload.hadBom,
        lineEnding,
        showOutline: payload.language === 'markdown' && settings.showOutline,
      };
      this.tabs.push(tab);
      this.activeId = tab.id;
      return tab;
    },
    /** #317 — apply a fresh read of the file to an open tab. The tab ends up
     *  clean, because what it shows is exactly what the file holds. Line
     *  endings are normalized the way `openFromDisk` does, or the tab would
     *  read as dirty the moment the editor touched it. Returns whether
     *  anything actually changed. */
    applyDiskRead(
      id: string,
      payload: { content: string; encoding: string; hadBom: boolean },
    ): boolean {
      const t = this.tabs.find((x) => x.id === id);
      if (!t) return false;
      const lineEnding: 'lf' | 'crlf' = payload.content.includes('\r\n') ? 'crlf' : 'lf';
      const normalized =
        lineEnding === 'crlf' ? payload.content.replace(/\r\n/g, '\n') : payload.content;
      const changed = t.content !== normalized || t.savedContent !== normalized;
      t.content = normalized;
      t.savedContent = normalized;
      t.encoding = payload.encoding;
      t.hadBom = payload.hadBom;
      t.lineEnding = lineEnding;
      return changed;
    },
    setContent(id: string, content: string) {
      const t = this.tabs.find((x) => x.id === id);
      if (t) t.content = content;
    },
    /** v4.6 F1 — apply content that was just written to disk by an external
     *  path (the Properties inspector's Rust frontmatter round-trip). Sets both
     *  `content` (so the editor reflows) and `savedContent` (so the tab is NOT
     *  left falsely dirty, since the bytes already match disk). Unlike
     *  `markSaved` this does no goal-stamping — the on-disk file IS the source
     *  of truth here and must stay byte-identical to what the editor shows. */
    applyExternalSave(id: string, content: string) {
      const t = this.tabs.find((x) => x.id === id);
      if (!t) return;
      t.content = content;
      t.savedContent = content;
    },
    /** #91 — repoint a tab at a new path WITHOUT touching `savedContent`.
     *  Used when a file is renamed while it has unsaved edits: the on-disk
     *  file (now at `filePath`) still holds the old, last-saved bytes, which
     *  are exactly this tab's `savedContent`, so the tab must stay dirty
     *  (content !== savedContent) — otherwise the unsaved-dot vanishes and
     *  closing the tab silently drops the edits. markSaved() is wrong here
     *  because it sets savedContent = content (marks the tab clean). */
    renamePath(id: string, filePath: string) {
      const t = this.tabs.find((x) => x.id === id);
      if (!t) return;
      t.filePath = filePath;
      t.fileName = filePath.split(/[\\/]/).pop() ?? t.fileName;
      t.language = inferLanguage(t.fileName);
    },
    markSaved(id: string, filePath: string) {
      const t = this.tabs.find((x) => x.id === id);
      if (!t) return;
      t.filePath = filePath;
      t.fileName = fileNameFromSavedPath(filePath, t.fileName);
      // v2.5 — auto-stamp `goal_set_at: <today>` on the first save of any
      // doc that declares a `goal:`. This is the anchor the streak counter
      // uses. Idempotent — no-op when the field already exists or there's
      // no goal declared.
      const stamped = stampGoalSetAtIfMissing(t.content);
      if (stamped !== t.content) {
        t.content = stamped;
      }
      t.savedContent = t.content;
      t.language = inferLanguage(t.fileName);
      this.closeDuplicatesOf(id, filePath);
      // v2.5 — push a "saved" anchor into the writing-session store so the
      // popover can show "since last save" instead of "since open".
      try {
        const ws = useWritingSessionStore();
        ws.markSaved(filePath, ws.sessionForPath(filePath)?.current ?? 0);
      } catch {}
    },
    closeDuplicatesOf(keepId: string, filePath: string) {
      const duplicates = this.tabs.filter((o) => o.id !== keepId && o.filePath === filePath);
      if (duplicates.length === 0) return;
      const wasActiveDuplicate = duplicates.some((o) => o.id === this.activeId);
      for (const other of duplicates) this.closeTab(other.id);
      if (wasActiveDuplicate) this.activeId = keepId;
    },
    closeTab(id: string) {
      const idx = this.tabs.findIndex((t) => t.id === id);
      if (idx === -1) return;
      const closed = this.tabs[idx];
      this.tabs.splice(idx, 1);
      if (this.activeId === id) {
        this.activeId = this.tabs[idx]?.id ?? this.tabs[idx - 1]?.id ?? '';
      }
      // Clean up any pane references to the closed tab
      try {
        const tiles = useTilesStore();
        tiles.removePaneReferences(id);
      } catch {}
      // v2.5 — drop the writing-session anchor for this doc so that
      // closing then reopening starts a fresh "since opened" delta.
      try {
        const ws = useWritingSessionStore();
        const key = closed?.filePath || closed?.id;
        if (key) ws.closePath(key);
      } catch {}
      if (this.tabs.length === 0) this.newTab();
    },
    activate(id: string) {
      this.activeId = id;
    },
    /** #86 — move tab `tabId` to `intendedIndex` (the position in the list
     *  where the user wants it dropped). Handles the shift caused by removing
     *  the source: dragging right (fromIdx < intended) decrements the target
     *  by one after the splice. No-op when the tab is dropped onto itself or
     *  doesn't exist. */
    reorder(tabId: string, intendedIndex: number) {
      const fromIdx = this.tabs.findIndex((t) => t.id === tabId);
      if (fromIdx < 0) return;
      intendedIndex = clampReorderIndex(this.tabs, tabId, intendedIndex);
      // Adjust BEFORE the splice: removing the source shifts positions to the
      // right of fromIdx down by one. So when intendedIndex (in the original
      // list) is to the right of fromIdx, the actual target after removal is
      // intendedIndex - 1.
      const adjusted = fromIdx < intendedIndex ? intendedIndex - 1 : intendedIndex;
      const [moved] = this.tabs.splice(fromIdx, 1);
      const target = Math.max(0, Math.min(adjusted, this.tabs.length));
      if (target === fromIdx) { this.tabs.splice(fromIdx, 0, moved); return; }
      this.tabs.splice(target, 0, moved);
    },
    togglePin(id: string) {
      togglePinned(this.tabs, id);
      this.persist();
    },
    toggleOutline(id: string) {
      const t = this.tabs.find((x) => x.id === id);
      if (t) {
        t.showOutline = !t.showOutline;
        // #207 — turning the outline ON must also un-hide the right sidebar:
        // once every pane was toggled off, the sidebar auto-hid and every
        // outline entry point (shortcut / settings / tab button) flipped the
        // flag invisibly, with no surface left to re-open it from.
        if (t.showOutline) useSettingsStore().ensureRightSidebarVisible();
      }
    },
    /** A mounted MindmapView claims the event so its JSON-exit guard runs;
     *  a tab with no live view has no editor to guard, so write the lens directly. */
    toggleMindmapData(id: string) {
      const t = this.tabs.find((x) => x.id === id);
      if (!t || t.language !== 'mindmap') return;
      const detail: SetLensDetail = { tabId: id, lens: dataToggleTarget(resolveTabLens(t)) };
      const event = new CustomEvent<SetLensDetail>(MINDMAP_SET_LENS_EVENT, { detail, cancelable: true });
      if (!window.dispatchEvent(event)) return;
      t.mindmapLens = detail.lens;
      delete t.mindmapMode;
      this.persist();
    },
    setShowOutlineAll(value: boolean) {
      for (const t of this.tabs) {
        if (t.language === 'markdown') t.showOutline = value;
      }
      if (value) useSettingsStore().ensureRightSidebarVisible();
    },
    persistedState(): PersistedState {
      const tabs = this.persistableTabs;
      const activeKept = tabs.some((x) => x.id === this.activeId);
      return { tabs, activeId: activeKept ? this.activeId : tabs[0]?.id ?? '' };
    },
    openThemeStudio() {
      const existing = this.tabs.find((x) => x.language === 'theme-studio');
      if (existing) {
        this.activeId = existing.id;
        return;
      }
      this.newTab({ fileName: THEME_STUDIO_TITLE, language: 'theme-studio' });
    },
    openGitDiff(ref: DiffTabRef) {
      const filePath = encodeDiffPath(ref);
      const existing = this.tabs.find((x) => x.filePath === filePath);
      if (existing) {
        this.activeId = existing.id;
        return;
      }
      const name = ref.path.split('/').pop() ?? ref.path;
      const tab = this.newTab({ fileName: `${name} (diff)`, language: 'git-diff' });
      tab.filePath = filePath;
    },
    persist() {
      writeBucket(bucketKey(currentWorkspaceFolder()), this.persistedState());
    },
    /** #103 — when this is an auxiliary window, record it in the shared
     *  windows registry so the main window re-spawns it on the next launch.
     *  `path` is the document the window was opened to show; it's stored as
     *  the window's restore anchor. No-op in the main window. */
    registerAuxWindow(path: string) {
      const suffix = windowScopeSuffix();
      if (!suffix) return; // main window — nothing to register
      const label = currentWindowLabel();
      try {
        useWindowsStore().register(label, {
          path,
          folder: currentWorkspaceFolder(),
        });
      } catch {}
    },
    /** Write the current view into a specific workspace's bucket (used when
     *  leaving a workspace, so it's remembered when the user returns). */
    persistToFolder(folder: string | null) {
      if (!perWorkspaceTabsEnabled()) return this.persist();
      writeBucket(bucketKey(folder), this.persistedState());
    },
    /** Called by the workspace store when the active folder changes. Saves
     *  the current view into the previous workspace's bucket, then swaps in
     *  the new workspace's remembered tabs. Unsaved (dirty) and untitled
     *  tabs are always carried across so no in-progress work is ever lost. */
    closeGitDiffTabs() {
      for (const tab of this.tabs.filter((t) => t.language === 'git-diff')) this.closeTab(tab.id);
    },
    onWorkspaceSwitched(prevFolder: string | null, newFolder: string | null) {
      const settings = useSettingsStore();
      this.closeGitDiffTabs();
      if (!settings.perWorkspaceTabs) return;
      // Remember what was open in the workspace we're leaving.
      this.persistToFolder(prevFolder);
      // Tabs that must follow the user regardless of workspace: anything
      // with unsaved work. `isDirty` covers both dirty saved files AND
      // untitled buffers that have content (their savedContent is empty, so
      // any typed text makes them dirty). A blank untitled tab is disposable
      // — not carried — so entering empty workspaces doesn't accumulate
      // empty scratch tabs.
      const carried = this.tabs.filter((t) => isDirty(t));
      // The new workspace's remembered tabs (only when session restore is on;
      // otherwise we just scope down to the carried set — a blank-ish slate).
      const restored = settings.restoreSession
        ? readBucket(bucketKey(newFolder)) ?? { tabs: [], activeId: '' }
        : { tabs: [], activeId: '' };
      const merged = mergeTabsDedup(carried, restored.tabs);
      const removed = this.tabs.filter((t) => !merged.some((m) => m.id === t.id));
      this.tabs = merged;
      if (removed.some((t) => t.language === 'theme-studio')) useThemeStudio().resetDraft();
      // Pick an active tab: prefer the restored bucket's active, else keep
      // the current one if it survived, else the first tab.
      const ids = new Set(merged.map((t) => t.id));
      if (restored.activeId && ids.has(restored.activeId)) {
        this.activeId = restored.activeId;
      } else if (!ids.has(this.activeId)) {
        this.activeId = merged[0]?.id ?? '';
      }
      // Drop split-pane references to tabs that are no longer open, then
      // make sure at least one tab exists.
      try {
        const tiles = useTilesStore();
        for (const t of removed) tiles.removePaneReferences(t.id);
        tiles.validate(this.tabs);
      } catch {}
      if (this.tabs.length === 0) this.newTab();
      this.persist();
    },
  },
});
