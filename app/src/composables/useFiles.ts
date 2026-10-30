import { inject } from 'vue';
import { dialogPort } from '../platform/index.ts';
import { useTabsStore } from '../stores/tabs';
import { useWorkspaceStore } from '../stores/workspace';
import { useSettingsStore } from '../stores/settings';
import { useToastsStore } from '../stores/toasts';
import { useRecentEditsStore } from '../stores/recentEdits';
import { useWindowsStore } from '../stores/windows';
import { useI18n } from '../i18n';
import { useConvertedOutput } from './useConvertedOutput';
import { createAuxWindowSpawner } from './files/aux-window.ts';
import { createImageOpener } from './files/open-image.ts';
import { createXmindOpener } from './files/open-xmind.ts';
import { createConvertOpeners } from './files/open-convert.ts';
import { createPickers } from './files/pickers.ts';
import { createFolderOpener } from './files/open-folder.ts';
import { createPathOpener } from './files/open-path.ts';
import { createSaver } from './files/save.ts';
import { createTabCloser, type UnsavedDialog } from './files/close-tab.ts';
import type { FilesCtx, OpenPath } from './files/files-ctx.ts';

export { deriveNameFromHeading } from './files/file-names.ts';

export function useFiles() {
  const tabs = useTabsStore();
  const { openConvertedContent } = useConvertedOutput();
  const workspace = useWorkspaceStore();
  const settings = useSettingsStore();
  const toasts = useToastsStore();
  const recentEdits = useRecentEditsStore();
  const windowsStore = useWindowsStore();
  const { t } = useI18n();
  const ctx: FilesCtx = { tabs, workspace, settings, toasts, recentEdits, windowsStore, t, openConvertedContent };

  const spawnAuxWindow = createAuxWindowSpawner(ctx);
  const openImageFile = createImageOpener(ctx);
  const { pickerStartDir, filePickerStartDir } = createPickers(ctx);
  const { openFolder, openFolderPath } = createFolderOpener(ctx, pickerStartDir);
  const openPath: OpenPath = (path, opts) => pathOpener.openPath(path, opts);
  const openXmind = createXmindOpener(ctx, openPath);
  const { openAndConvert, importDocuments } = createConvertOpeners(ctx, openPath, filePickerStartDir);
  const pathOpener = createPathOpener(ctx, { spawnAuxWindow, openImageFile, openFolderPath, openXmind, openAndConvert });
  const { openLinkedFile } = pathOpener;

  async function newFile() {
    tabs.newTab();
  }

  async function newTextFile() {
    tabs.newTab({ fileName: 'Untitled.txt', language: 'plaintext' });
  }

  async function openFile() {
    // No filters: rfd's filter behavior on macOS greys out non-matching files
    // and `'*'` is not treated as a wildcard. Letting the user pick anything
    // is simpler and more reliable.
    const selected = await dialogPort.open({
      multiple: false,
      defaultPath: await filePickerStartDir(),
    });
    if (!selected || typeof selected !== 'string') return;
    await openPath(selected);
  }

  const saver = createSaver(ctx, pickerStartDir);
  const { saveTab, saveTabAs, saveActive, saveActiveAs, autoSaveDirtyTabs, saveThemeStudioDraft } = saver;

  // Pass `null` default so Vue doesn't emit "injection not found" warnings
  // when useFiles() is called before App.vue's provide() runs (e.g. inside
  // App.vue's own setup). The real dialog is always available via the
  // window global fallback below.
  const injectedDialog = inject<UnsavedDialog | null>('showUnsavedDialog', null);

  function getUnsavedDialog(): UnsavedDialog | undefined {
    if (injectedDialog) return injectedDialog;
    const w = window as unknown as { __solomd_showUnsavedDialog?: UnsavedDialog };
    return w.__solomd_showUnsavedDialog;
  }

  const closeTabSafe = createTabCloser(ctx, { getUnsavedDialog, saveTab, saveThemeStudioDraft });

  return {
    newFile,
    newTextFile,
    openFile,
    importDocuments,
    openPath,
    openLinkedFile,
    openFolder,
    // Starting directories for the OS dialogs. Every picker needs one: an
    // unset `defaultPath` is not "neutral" on Windows — it strands the dialog
    // on the shell's virtual desktop root, which OK cannot return.
    pickerStartDir,
    filePickerStartDir,
    saveActive,
    saveActiveAs,
    // Exposed for the task panel: ticking a checkbox in a file that happens to
    // be open has to go through the tab, not straight to disk, or the tab's
    // in-memory copy would silently overwrite it on the next save.
    saveTab,
    saveTabAs,
    autoSaveDirtyTabs,
    closeTabSafe,
    spawnAuxWindow,
  };
}
