import { dialogPort, pathPort } from '../../platform/index.ts';
import { isIOS, isAndroid } from '../../lib/platform';
import { safLaunchPicker } from '../../lib/saf-fs';
import type { FilesCtx, PickerStartDir } from './files-ctx.ts';

export function createFolderOpener(
  ctx: FilesCtx,
  pickerStartDir: PickerStartDir,
) {
  const { workspace, settings, toasts } = ctx;

  function openFolderPath(path: string): void {
    workspace.setFolder(path);
    if (!settings.showFileTree) settings.toggleFileTree();
  }

  async function openFolder() {
    // Open the OS folder picker rooted at the previously chosen workspace
    // so the user lands in a familiar tree, not at $HOME or wherever the
    // OS defaults. Without `defaultPath` Tauri's picker re-opens at the
    // OS-level last-used directory, which is unrelated to SoloMD state
    // and surprised users with a "why isn't my last folder remembered"
    // bug. We persist `currentFolder` already; this just feeds it back —
    // via pickerStartDir(), which guarantees the folder it hands over
    // actually exists (see there for why that matters on Windows).
    //
    // #96 fix: on Android, `openDialog({ directory: true })` resolves to
    // `null` silently — Tauri's dialog plugin doesn't surface SAF's
    // directory-tree picker on Android, so the button looked dead. Mirror
    // iOS behaviour and pin the workspace to the app's Documents dir.
    // The user can drop .md files into that folder via the Files app
    // ("On My Device > SoloMD"); SoloMD reads them back on next open.
    // #139 — neither Android nor iOS surfaces a usable OS folder picker
    // through Tauri's dialog plugin (`openDialog({directory:true})` resolves to
    // null), so the "Open Folder" button looked dead on both. Mirror the
    // Android behaviour on iOS: pin the workspace to the app's own Documents
    // dir ("On My iPhone/iPad › SoloMD" via UIFileSharingEnabled). Users drop
    // .md files there through the Files app and they show up in the tree.
    // #148 / #151 — Android: with all-files access the user can point SoloMD
    // at a REAL vault folder anywhere on shared storage (…/Documents, a
    // Syncthing/Dropbox dir) and edit in place, instead of being stuck with
    // the unreachable /Android/data sandbox. Check the permission; if missing,
    // prompt the user to grant it in Settings (App.vue drives the request +
    // re-check on resume); if granted, open our own folder browser.
    if (isAndroid()) {
      // #148 — use the Storage Access Framework. MANAGE_EXTERNAL_STORAGE is
      // unreliable across OEMs (grants nothing on Honor/Huawei Magic OS — the
      // permission reads as granted but std::fs still hits EACCES even after a
      // restart), while SAF works everywhere with no special permission. The
      // user picks a folder in the system dialog; we read/write it via
      // ContentResolver (see lib/saf-fs.ts).
      try {
        // Launch and mark that a pick is in flight; App.vue resolves the result
        // on resume (the picker backgrounds our WebView, so we can't await it
        // inline — the JS poll loop is lost across the transition).
        localStorage.setItem('solomd:saf-picking', '1');
        await safLaunchPicker();
      } catch (e) {
        localStorage.removeItem('solomd:saf-picking');
        toasts.error(String(e));
      }
      return;
    }
    if (isIOS()) {
      try {
        const dir = await pathPort.documentDir();
        workspace.setFolder(dir);
        if (!settings.showFileTree) settings.toggleFileTree();
        toasts.info(
          `Workspace pinned to the SoloMD folder. Drop .md files there via the Files app and they'll show up here.`,
        );
      } catch (e) {
        toasts.error(String(e));
      }
      return;
    }
    const selected = await dialogPort.open({
      directory: true,
      multiple: false,
      defaultPath: await pickerStartDir(),
    });
    if (!selected || typeof selected !== 'string') return;
    openFolderPath(selected);
  }

  return { openFolder, openFolderPath };
}
