import { fsPort, pathPort, openerPort } from '../../platform/index.ts';
import { isIOS, isAndroid } from '../../lib/platform';
import { isNarrowViewport } from '../useViewport';
import { isSafPath, fromSafPath, safRead } from '../../lib/saf-fs';
import { fileNameOf } from '../../lib/import-plan';
import { isXmindPath } from '../../lib/mindmap-format';
import { importContentUri } from './content-uri.ts';
import { stripFileUrl, isIosContainerPath, reanchorIosPath } from './file-names.ts';
import {
  CONVERT_BUILTIN,
  CONVERT_CLI,
  IMAGE_EXTENSIONS,
  TEXT_LINK_EXTENSIONS,
  fileExtension,
} from './file-kinds.ts';
import type { FilesCtx, OpenPathOptions } from './files-ctx.ts';

export interface PathOpenerDeps {
  spawnAuxWindow: (path: string) => string | null;
  openImageFile: (path: string) => Promise<void>;
  openFolderPath: (path: string) => void;
  openXmind: (path: string) => Promise<void>;
  openAndConvert: (path: string, ext: string) => Promise<void>;
}

export function createPathOpener(ctx: FilesCtx, deps: PathOpenerDeps) {
  const { tabs, workspace, settings, toasts } = ctx;
  const { spawnAuxWindow, openImageFile, openFolderPath, openXmind, openAndConvert } = deps;

  async function openPath(path: string, opts: OpenPathOptions = {}): Promise<void> {
    // #148 — see importContentUri; must run before any path parsing below.
    if (isAndroid() && path.startsWith('content://')) {
      try {
        path = await importContentUri(path);
      } catch (e) {
        console.error('content:// import failed', e);
        toasts.error(`Failed to open: ${e}`);
        return;
      }
    }

    // #139 — normalize `file://` URLs to a plain filesystem path here, at the
    // single shared entry point. On iOS a Files-app open arrives via the
    // `solomd://opened-file` channel as a raw, percent-encoded file URL
    // (e.g. file:///private/var/.../tmp/app.solomd-Inbox/Markdown%20%E8%AF%AD….md)
    // and was handed straight to Rust's fs::read, which then failed with
    // "No such file or directory" because the scheme + %-encoding made it a
    // bogus path. iOS already copied the file into our sandbox (readable), so
    // the only bug was the un-decoded URL. Stripping the scheme + decoding
    // fixes it; desktop absolute paths (no scheme) pass through untouched, and
    // the deep-link channel that already strips is a harmless no-op here.
    path = stripFileUrl(path);

    // #139 — iOS app-container paths embed a per-install UUID
    // (/…/Data/Application/<UUID>/…) that iOS CHANGES on every app update, so
    // an absolute path persisted in "recent files" (or a restored tab) points
    // at a dead container after any update — the reporter saw "Documents
    // unreadable" for recents whose UUID no longer matched. Re-anchor any
    // stored container path onto the CURRENT container root before reading.
    // (A fresh in-session path re-maps to itself — harmless no-op.)
    // Anchor on `/Data/Application/` (lazy `.*?` = first occurrence): a greedy
    // bare `/Application/` match would eat a user folder literally named
    // "Application" below Documents, and would also mis-rewrite app-BUNDLE
    // paths (/…/Bundle/Application/<UUID>/…), which are not ours to re-anchor.
    if (isIOS() && isIosContainerPath(path)) {
      try {
        path = reanchorIosPath(path, await pathPort.documentDir());
      } catch {
        /* documentDir unavailable — leave path as-is */
      }
    }

    // Folder arguments reuse the picker flow before any file-specific routing.
    if (!isAndroid() && !isIOS() && await fsPort.fsDirExists({ path })) {
      openFolderPath(path);
      return;
    }

    // #98 — image files open in the fullscreen overlay viewer, never as a
    // tab and never in a new window (an overlay isn't document content, so
    // routing it through the markitdown converter just toasts an error).
    const imgExt = fileExtension(path);
    if (IMAGE_EXTENSIONS.has(imgExt)) {
      return openImageFile(path);
    }

    // Spawn a new Tauri window with the path in the query string when the
    // user has opted in. Only applies when the current window already has
    // at least one tab (fresh-launch first file should stay in this window).
    if (
      settings.openFileInNewWindow &&
      !opts.bypassNewWindow &&
      tabs.tabs.length > 0
    ) {
      if (spawnAuxWindow(path)) return;
      // Window creation failed — fall through to in-tab open.
    }

    const ext = fileExtension(path);

    if (isXmindPath(path)) {
      return openXmind(path);
    }

    // If it's a convertible format, convert to Markdown first.
    if (CONVERT_BUILTIN.has(ext) || CONVERT_CLI.has(ext)) {
      return openAndConvert(path, ext);
    }

    // Native open: text files, markdown, code, etc.
    try {
      // #148 — SAF vault file: read through ContentResolver. The parent is
      // already the open vault, so skip the reveal-parent dance below.
      const isSaf = isSafPath(path);
      const result = isSaf
        ? await safRead(workspace.safTreeUri!, fromSafPath(path))
        : await fsPort.readFile({ path });

      // Reveal the file's folder in the sidebar BEFORE adding the tab.
      // Order matters: `workspace.setFolder` switches the per-workspace tab
      // session (tabs.onWorkspaceSwitched), and that swap only *carries* DIRTY
      // tabs across a folder change. A freshly opened CLEAN file added BEFORE
      // the switch would be discarded — the editor kept showing the previously
      // open document (or a blank Untitled) while the tree revealed the new
      // folder, and only a close+reopen "fixed" it (by then the folder was
      // already current). That was the real "double-click opens nothing" bug.
      // Switching first means `openFromDisk` below adds the tab into the
      // already-settled workspace, so it survives and becomes active.
      if (opts.revealInTree !== false && settings.revealInFileTreeOnOpen && !isSaf) {
        const parent = path.replace(/[\\/][^\\/]+$/, '');
        if (parent && parent !== path) {
          workspace.setFolder(parent);
          if (!settings.showFileTree) settings.toggleFileTree();
        }
      }

      tabs.openFromDisk({
        filePath: path,
        content: result.content,
        encoding: result.encoding,
        language: result.language,
        hadBom: result.had_bom,
      });
      workspace.pushRecent(path);
      // #148 / #168 — on a phone the tree is a drawer over the editor, so
      // close it once a file opens: picking a file means you want to read it.
      // Keyed off viewport width (not the UA) so a narrow desktop window
      // behaves the same way the layout does.
      if (isNarrowViewport() && settings.showFileTree) settings.toggleFileTree();
      const fileName = fileNameOf(path);
      toasts.success(`Opened ${fileName}`);
    } catch (e) {
      console.error('open failed', e);
      toasts.error(`Failed to open file: ${e}`);
    }
  }

  /**
   * Open a file that was reached by clicking a Markdown LINK (not the file
   * tree). When `openLinkedFilesExternally` is on, a link to a non-text,
   * non-image document (PDF, Office, audio, archives, unknown binaries) is
   * handed to the OS default app — matching the "click the link to open the
   * file" intuition users have from Typora / Obsidian. Markdown / text / code
   * and images always stay inside SoloMD (editor tab / image overlay). When
   * the setting is off, everything routes through `openPath` as before
   * (PDF/PPTX/EPUB → markitdown conversion).
   */
  async function openLinkedFile(
    path: string,
    opts: { bypassNewWindow?: boolean } = {},
  ): Promise<void> {
    const ext = fileExtension(path);
    const isImage = IMAGE_EXTENSIONS.has(ext);
    const isTextLike = TEXT_LINK_EXTENSIONS.has(ext);
    if (settings.openLinkedFilesExternally && !isImage && !isTextLike) {
      if (import.meta.env.DEV) {
        (window as unknown as { __lastLinkOpen?: unknown }).__lastLinkOpen = {
          mode: 'external',
          path,
        };
      }
      try {
        await openerPort.openPath(path);
      } catch (e) {
        console.error('openWithSystemDefault failed', e);
        toasts.error(`Failed to open: ${e}`);
      }
      return;
    }
    if (import.meta.env.DEV) {
      (window as unknown as { __lastLinkOpen?: unknown }).__lastLinkOpen = {
        mode: isImage ? 'image' : isTextLike ? 'internal' : 'convert',
        path,
      };
    }
    return openPath(path, opts);
  }

  return { openPath, openLinkedFile };
}
