import { fsPort, pathPort, dialogPort } from '../../platform/index.ts';
import { isIOS } from '../../lib/platform';
import { useGitPaneStore } from '../../stores/gitPane';
import { useThemeStudio } from '../theme/useThemeStudio';
import type { Tab } from '../../types';
import { isSafPath, fromSafPath, safWrite } from '../../lib/saf-fs';
import { joinInFolder } from '../../lib/import-plan';
import { newFileDirFor, treeSelection } from '../../lib/new-file-target';
import { MMAP_EXTENSION, isXmindPath, mmapPathFor } from '../../lib/mindmap/format';
import { untitledFileName } from '../../lib/file-language';
import { isVirtualLanguage } from '../../lib/virtual-tabs';
import { deriveNameFromHeading, contentUriName } from './file-names.ts';
import { writeContentUri } from './content-uri.ts';
import type { FilesCtx, PickerStartDir } from './files-ctx.ts';

const SAVE_FILTERS = [
  { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
  { name: 'Mindmap', extensions: [MMAP_EXTENSION] },
  { name: 'Plain Text', extensions: ['txt'] },
];

export function createSaver(ctx: FilesCtx, pickerStartDir: PickerStartDir) {
  const { tabs, workspace, settings, toasts, recentEdits, t } = ctx;

  // iOS save policy: ignore the in-place path (could be a security-scoped
  // URL from a "Open With" deep-link — unwritable from plain Rust fs) and
  // route everything through the app's own Documents directory. With
  // UIFileSharingEnabled set, that folder appears as "On My iPhone › SoloMD"
  // in the Files app, so users can iCloud-sync or move from there.
  async function iosResolvePath(tab: Tab): Promise<string> {
    const fname =
      deriveNameFromHeading(tab) ||
      tab.fileName ||
      untitledFileName(tab.language);
    const dir = await pathPort.documentDir();
    return await pathPort.join(dir, fname);
  }


  function refuseXmindWrite(path: string): boolean {
    if (!isXmindPath(path)) return false;
    toasts.error(`SoloMD does not write .xmind files — save as .${MMAP_EXTENSION}`);
    return true;
  }

  async function saveTab(tab: Tab, opts: { silent?: boolean } = {}): Promise<boolean> {
    if (isVirtualLanguage(tab.language)) return false;
    // #222 — the CodeMirror editor syncs doc→tab.content on a 350ms debounce.
    // A save issued inside that window (vim `:w`/`:wq`, a fast Ctrl+S) would
    // read a stale document; for `:wq` the tab then closes and the tail of the
    // edit is silently lost. Editors flush their pending sync synchronously on
    // this event, so `tab.content` below is current.
    window.dispatchEvent(new Event('solomd:flush-content-sync'));
    let path = tab.filePath;
    if (isIOS()) {
      // On iOS, never trust the existing path — it may have come from a
      // deep-link "Open With" and not be writable from Rust fs. Always
      // route to Documents.
      path = await iosResolvePath(tab);
    } else if (!path) {
      return saveTabAs(tab);
    }
    if (refuseXmindWrite(path)) return false;
    try {
      // Restore the file's original line endings on write — we
      // normalize CRLF→LF on open so CodeMirror behaves, but the user
      // expects a Windows-saved file to stay Windows-saved.
      const payload =
        tab.lineEnding === 'crlf' ? tab.content.replace(/\n/g, '\r\n') : tab.content;
      // #148 — SAF vault: write through ContentResolver. Git/AutoGit can't
      // operate on content-URI paths, so skip the recent/MFU/AutoGit hooks
      // (they key off real filesystem paths) for SAF saves.
      const isSaf = isSafPath(path);
      const isContentUri = path.startsWith('content://');
      if (isSaf) {
        await safWrite(workspace.safTreeUri!, fromSafPath(path), payload);
      } else if (isContentUri) {
        // Android — a tab previously Saved-As through the SAF dialog keeps
        // its content:// URI as filePath; Ctrl+S must take the same
        // ContentResolver route as the original save.
        await writeContentUri(path, payload);
      } else {
        await fsPort.writeFile({
          path,
          content: payload,
          encoding: tab.encoding || 'UTF-8',
        });
      }
      tabs.markSaved(tab.id, path);
      if (!isSaf && !isContentUri) {
        workspace.pushRecent(path);
        // v2.5: feed the ⌘P quick-switcher's MFU ranking.
        recentEdits.recordEdit(path);
        // v2.2: notify the AutoGit composable so the debounced auto-commit
        // pipeline picks up this save. Listener is in `useAutoCommit.ts`.
        window.dispatchEvent(
          new CustomEvent('solomd:saved', { detail: { filePath: path } }),
        );
        useGitPaneStore().scheduleRefresh();
      }
      if (!opts.silent) {
        if (isIOS()) {
          const fname = path.split(/[\\/]/).pop() ?? path;
          toasts.success(`Saved to On My iPhone › SoloMD › ${fname}`);
        } else {
          toasts.success(`Saved ${tab.fileName}`);
        }
      }
      return true;
    } catch (e) {
      console.error('save failed', e);
      toasts.error(`Failed to save: ${e}`);
      return false;
    }
  }

  async function saveTabAs(tab: Tab): Promise<boolean> {
    if (isVirtualLanguage(tab.language)) return false;
    const defaultName =
      deriveNameFromHeading(tab) ||
      tab.fileName ||
      untitledFileName(tab.language);
    let path: string | null;
    if (isIOS()) {
      // iOS: no Save-As picker UI that round-trips to Rust safely. Write
      // straight to app Documents; user surfaces / moves via Files app.
      path = await iosResolvePath(tab);
    } else {
      // A document with no path yet (File → New, the toolbar ＋, Ctrl+N) is
      // being named for the first time: open the dialog in the folder the user
      // is actually looking at — the Explorer's selection (a folder, or the
      // folder of the selected file), else the open document's folder —
      // instead of wherever the OS save dialog remembered last. An existing
      // file keeps its own path, which is what "Save As" means. Imported tabs
      // default to the sibling `.mmap` of their source.
      const importedPath = tab.importedFrom ? mmapPathFor(tab.importedFrom) : undefined;
      const dir = tab.filePath || importedPath
        ? null
        : await pickerStartDir(newFileDirFor(treeSelection(), tabs.activeTab?.filePath));
      path = await dialogPort.save({
        defaultPath: tab.filePath ?? importedPath ?? (dir ? joinInFolder(dir, defaultName) : defaultName),
        filters: SAVE_FILTERS,
      });
      if (!path) return false;
    }
    if (refuseXmindWrite(path)) return false;
    try {
      const payload =
        tab.lineEnding === 'crlf' ? tab.content.replace(/\n/g, '\r\n') : tab.content;
      // Android — the SAF save dialog returns a content:// URI (and has
      // already created the empty document); write the bytes through
      // ContentResolver, not std::fs. The fs-path-keyed hooks below
      // (recents/MFU/AutoGit) are skipped, same as SAF-vault saves.
      const isContentUri = path.startsWith('content://');
      if (isContentUri) {
        await writeContentUri(path, payload);
        tabs.markSaved(tab.id, path);
        const fileName = contentUriName(path);
        toasts.success(`Saved as ${fileName}`);
        return true;
      }
      await fsPort.writeFile({
        path,
        content: payload,
        encoding: tab.encoding || 'UTF-8',
      });
      tabs.markSaved(tab.id, path);
      workspace.pushRecent(path);
      // v2.5: feed the ⌘P quick-switcher's MFU ranking.
      recentEdits.recordEdit(path);
      window.dispatchEvent(
        new CustomEvent('solomd:saved', { detail: { filePath: path } }),
      );
      const fileName = path.split(/[\\/]/).pop() ?? path;
      toasts.success(isIOS() ? `Saved to On My iPhone › SoloMD › ${fileName}` : `Saved as ${fileName}`);
      return true;
    } catch (e) {
      console.error('save-as failed', e);
      toasts.error(`Failed to save: ${e}`);
      return false;
    }
  }

  async function saveActive() {
    const active = tabs.activeTab;
    if (!active) return;
    if (active.language === 'theme-studio') {
      await saveThemeStudioDraft();
      return;
    }
    await saveTab(active);
  }

  async function saveActiveAs() {
    if (tabs.activeTab) await saveTabAs(tabs.activeTab);
  }

  // #85 — auto-save on window blur. Persist every dirty tab that already has
  // a file path, silently (no per-file toast). Untitled tabs are skipped on
  // purpose: saving them would pop a Save-As dialog, which is jarring when
  // triggered by simply switching to another app. Errors still toast so a
  // failed background save isn't swallowed.
  async function autoSaveDirtyTabs(): Promise<void> {
    if (!settings.autoSaveOnBlur) return;
    for (const tab of tabs.tabs) {
      if (tab.filePath && tabs.isDirty(tab.id)) {
        await saveTab(tab, { silent: true });
      }
    }
  }

  async function saveThemeStudioDraft(): Promise<boolean> {
    const studio = useThemeStudio();
    const isSaved = await studio.saveDraft();
    if (!isSaved && !studio.hasSaveHandler.value) toasts.error(t('themeStudio.saveUnavailable'));
    return isSaved;
  }

  return { saveTab, saveTabAs, saveActive, saveActiveAs, autoSaveDirtyTabs, saveThemeStudioDraft };
}
