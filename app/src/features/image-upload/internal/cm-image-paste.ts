/**
 * Image paste / drag-drop extension for CodeMirror 6.
 *
 * Listens on the editor's host DOM for paste & drop events containing
 * image data. Saves each image to disk (via the `write_binary_file` Tauri
 * command), then inserts a markdown image reference at the cursor.
 *
 * Save location (only when the tab has a file path; otherwise → temp dir):
 *   - `shared` (default): `<dirname>/_assets/<filename>` — one shared
 *     folder per directory. Pre-v4.3.5 behavior; safe for legacy vaults.
 *   - `per-file`: `<dirname>/<basename>.assets/<filename>` — each .md gets
 *     its own assets folder. `fs_rename` on the Rust side moves the folder
 *     along with the file and rewrites link refs when the basename changes.
 */

import { EditorView } from '@codemirror/view';
import { fsPort } from '../../../platform/index.ts';
import { markdownImage } from '../../../lib/md-image-url.ts';
import { isContentUri, sniffImageExt } from '../../../lib/image-source.ts';
import type { ImagePasteOptions } from './image-paste-types.ts';
import { extFromMime, extFromName, makeFilename, randSuffix } from './image-paths.ts';
import {
  performUpload, prepareLocalTarget, prepareTempTarget, readContentUri, readFileAsUint8, reportFailure, writeBytes,
} from './image-paste-target.ts';

export type { ImagePasteOptions } from './image-paste-types.ts';
export { saveImageBytes, handleTextareaImagePaste, imageTextFromPath } from './image-paste-text.ts';

function insertAtCursor(view: EditorView, text: string): void {
  const pos = view.state.selection.main.head;
  view.dispatch({
    changes: { from: pos, insert: text },
    selection: { anchor: pos + text.length },
  });
}

/** Replace the `![](token)` upload placeholder with `finalText`, locating it
 *  live in the current doc so concurrent typing doesn't desync the position.
 *  No-op if the user already deleted the placeholder. */
function replaceToken(view: EditorView, token: string, finalText: string): void {
  const needle = `![](${token})`;
  const idx = view.state.doc.toString().indexOf(needle);
  if (idx < 0) return;
  view.dispatch({ changes: { from: idx, to: idx + needle.length, insert: finalText } });
}

/**
 * Save (and optionally upload) pasted/dropped image bytes, inserting the
 * resulting markdown at the cursor. When an uploader is configured with
 * auto-upload on, inserts an `![](token)` placeholder immediately, then swaps
 * in the hosted URL (or a local fallback) once the upload settles.
 */
async function saveAndInsert(
  view: EditorView,
  bytes: Uint8Array,
  ext: string,
  opts: ImagePasteOptions,
): Promise<void> {
  const filename = makeFilename(ext);
  const up = opts.getUploader ? opts.getUploader(filename) : null;
  const local = await prepareLocalTarget(filename, opts);

  if (!up || !up.onPaste) {
    if (await writeBytes(local.fullPath, bytes)) insertAtCursor(view, local.insertText);
    else reportFailure(opts, `could not write ${local.fullPath}`);
    return;
  }

  // Materialize the upload source: the assets file (keepLocal) or a temp copy.
  let srcPath: string;
  if (up.keepLocal) {
    if (!(await writeBytes(local.fullPath, bytes))) {
      insertAtCursor(view, local.insertText);
      return;
    }
    srcPath = local.fullPath;
  } else {
    const temp = await prepareTempTarget(filename, opts);
    if (!(await writeBytes(temp, bytes))) {
      // Temp write failed — fall back to a plain local save.
      if (await writeBytes(local.fullPath, bytes)) insertAtCursor(view, local.insertText);
      return;
    }
    srcPath = temp;
  }

  const token = `solomd-uploading-${randSuffix()}${randSuffix()}`;
  insertAtCursor(view, `![](${token})`);
  const finalText = await performUpload(up, srcPath, opts, async () => {
    // On failure keep a local copy: assets file already exists when keepLocal;
    // otherwise copy the temp file into the attachments folder.
    if (up.keepLocal) return local.insertText;
    try {
      await fsPort.copyFile({ src: srcPath, dst: local.fullPath });
      return local.insertText;
    } catch {
      return markdownImage(srcPath.replace(/\\/g, '/'));
    }
  });
  replaceToken(view, token, finalText);
}

async function handlePaste(
  event: ClipboardEvent,
  view: EditorView,
  opts: ImagePasteOptions,
): Promise<boolean> {
  const cd = event.clipboardData;
  if (!cd) return false;
  const items = cd.items;
  if (!items || items.length === 0) return false;

  const images: Array<{ blob: Blob; ext: string }> = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) images.push({ blob: f, ext: extFromName(f.name) || extFromMime(item.type) });
    }
  }
  if (images.length === 0) return false;

  event.preventDefault();
  for (const img of images) {
    const bytes = await readFileAsUint8(img.blob);
    await saveAndInsert(view, bytes, img.ext, opts);
  }
  return true;
}

async function handleDrop(
  event: DragEvent,
  view: EditorView,
  opts: ImagePasteOptions,
): Promise<boolean> {
  const dt = event.dataTransfer;
  if (!dt) return false;
  const files = dt.files;
  if (!files || files.length === 0) return false;

  const images: Array<{ file: File; ext: string }> = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f.type.startsWith('image/')) {
      images.push({ file: f, ext: extFromName(f.name) || extFromMime(f.type) });
    }
  }
  if (images.length === 0) return false;

  event.preventDefault();
  for (const img of images) {
    const bytes = await readFileAsUint8(img.file);
    await saveAndInsert(view, bytes, img.ext, opts);
  }
  return true;
}

/**
 * Insert a markdown image reference for an OS file path that the user
 * dragged into the window. Unlike paste/drop on the editor DOM (where we
 * already have the bytes), this path comes from Tauri's webview-level
 * drag-drop event, so we copy the file via the Rust `copy_file` command
 * instead of round-tripping bytes through JS.
 */
export async function insertImageFromPath(
  view: EditorView,
  srcPath: string,
  opts: ImagePasteOptions,
): Promise<void> {
  // #349 — Android pickers return content:// URIs: read the bytes and take
  // the paste path, which writes bytes instead of copying a file.
  if (isContentUri(srcPath)) {
    let bytes: Uint8Array;
    try {
      bytes = await readContentUri(srcPath);
    } catch (err) {
      reportFailure(opts, err);
      return;
    }
    await saveAndInsert(view, bytes, sniffImageExt(bytes) || extFromName(srcPath) || 'png', opts);
    return;
  }
  const ext = extFromName(srcPath) || 'png';
  const filename = makeFilename(ext);
  const up = opts.getUploader ? opts.getUploader(filename) : null;
  const local = await prepareLocalTarget(filename, opts);

  if (!up || !up.onPaste) {
    try {
      await fsPort.copyFile({ src: srcPath, dst: local.fullPath });
    } catch (err) {
      // Was a rethrow that nobody caught: the insert just didn't happen.
      reportFailure(opts, err);
      return;
    }
    insertAtCursor(view, local.insertText);
    return;
  }

  // Upload source: copy into the attachments folder first when keeping a local
  // copy; otherwise upload the original file in place (no copy needed).
  let uploadSrc = srcPath;
  if (up.keepLocal) {
    await fsPort.copyFile({ src: srcPath, dst: local.fullPath });
    uploadSrc = local.fullPath;
  }
  const token = `solomd-uploading-${randSuffix()}${randSuffix()}`;
  insertAtCursor(view, `![](${token})`);
  const finalText = await performUpload(up, uploadSrc, opts, async () => {
    if (up.keepLocal) return local.insertText;
    try {
      await fsPort.copyFile({ src: srcPath, dst: local.fullPath });
      return local.insertText;
    } catch {
      return markdownImage(srcPath.replace(/\\/g, '/'));
    }
  });
  replaceToken(view, token, finalText);
}

export function imagePasteExtension(opts: ImagePasteOptions) {
  return EditorView.domEventHandlers({
    paste(event, view) {
      // Fire and forget — the async handler calls preventDefault() sync
      // BEFORE any awaits, so the browser never inserts the image fallback.
      const cd = event.clipboardData;
      if (!cd || !cd.items) return false;
      let hasImage = false;
      for (let i = 0; i < cd.items.length; i++) {
        const it = cd.items[i];
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          hasImage = true;
          break;
        }
      }
      if (!hasImage) return false;
      event.preventDefault();
      void handlePaste(event, view, opts);
      return true;
    },
    drop(event, view) {
      const dt = event.dataTransfer;
      if (!dt || !dt.files || dt.files.length === 0) return false;
      let hasImage = false;
      for (let i = 0; i < dt.files.length; i++) {
        if (dt.files[i].type.startsWith('image/')) {
          hasImage = true;
          break;
        }
      }
      if (!hasImage) return false;
      event.preventDefault();
      void handleDrop(event, view, opts);
      return true;
    },
  });
}
