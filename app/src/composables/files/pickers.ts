import { fsPort, pathPort } from '../../platform/index.ts';
import type { FilesCtx } from './files-ctx.ts';

export function createPickers(ctx: FilesCtx) {
  const { tabs, workspace } = ctx;

  /** The starting folder handed to the OS folder picker.
   *
   *  Never let the picker open without one, and never hand it a path that is
   *  not a real directory:
   *
   *  - Windows' picker falls back to the shell's *Desktop root* when it is
   *    given no starting folder. That root is a namespace item, not a
   *    directory — it has no filesystem path — so pressing OK on it makes the
   *    shell answer "no object for moniker" (MK_E_UNAVAILABLE, localized: "no object available for
   *    the moniker") and refuse to close the dialog. "Open Folder" then reads
   *    as a dead button and the Desktop itself cannot be chosen.
   *  - rfd silently drops a starting folder it cannot resolve
   *    (`SHCreateItemFromParsingName` fails → `SetFolder` is skipped), so a
   *    remembered workspace on a deleted / unmounted path lands the user in
   *    exactly that virtual root.
   *
   *  A directory that exists keeps the dialog on the filesystem: the caller's
   *  own candidates first (a remembered path, the active file's folder), then
   *  the last workspace, else the Desktop (where the picker would have opened
   *  anyway), else Documents, else the home folder. */
  async function pickerStartDir(
    ...preferred: Array<string | null | undefined>
  ): Promise<string | undefined> {
    const candidates = [
      ...preferred,
      workspace.currentFolder,
      await pathPort.desktopDir().catch(() => null),
      await pathPort.documentDir().catch(() => null),
      await pathPort.homeDir().catch(() => null),
    ];
    for (const c of candidates) {
      if (!c) continue;
      try {
        // A SAF vault path ("saf:…") is not a filesystem path — skip it and
        // let the next candidate win, same as a folder that has gone away.
        if (await fsPort.fsDirExists({ path: c })) return c;
      } catch {
        /* path API unavailable — try the next candidate */
      }
    }
    return undefined;
  }

  /** Directory a *file* picker should open in.
   *
   *  The active document's folder first — that is where the next file the user
   *  reaches for almost always lives (an image next to the note, a sibling
   *  chapter, the CSS for the theme you're editing) — then the chain above. */
  async function filePickerStartDir(): Promise<string | undefined> {
    const active = tabs.activeTab?.filePath;
    const dir = active?.replace(/[\\/][^\\/]+$/, '');
    return pickerStartDir(dir && dir !== active ? dir : null);
  }

  return { pickerStartDir, filePickerStartDir };
}
