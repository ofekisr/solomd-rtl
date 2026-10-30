import { fsPort } from '../../../platform/index.ts';
import { markdownImage } from '../../../lib/md-image-url.ts';
import { isContentUri, sniffImageExt } from '../../../lib/image-source.ts';
import type { ImagePasteOptions } from './image-paste-types.ts';
import { extFromMime, extFromName, makeFilename } from './image-paths.ts';
import {
  performUpload, prepareLocalTarget, prepareTempTarget, readContentUri, readFileAsUint8, reportFailure, writeBytes,
} from './image-paste-target.ts';

/**
 * Persist image bytes locally and return the markdown link to insert, or null
 * on failure. Used by the Windows plain-textarea editor (which inserts text via
 * a callback rather than a CodeMirror view). No upload — kept simple.
 */
export async function saveImageBytes(
  bytes: Uint8Array,
  ext: string,
  opts: ImagePasteOptions,
): Promise<string | null> {
  const { fullPath, insertText } = await prepareLocalTarget(makeFilename(ext), opts);
  return (await writeBytes(fullPath, bytes)) ? insertText : null;
}

/**
 * Clipboard image paste for a plain `<textarea>` editor. Extracts image items,
 * saves them, and calls `insert` with each markdown link. Returns true if it
 * handled (and consumed) the paste.
 */
export async function handleTextareaImagePaste(
  event: ClipboardEvent,
  opts: ImagePasteOptions,
  insert: (text: string) => void,
): Promise<boolean> {
  const cd = event.clipboardData;
  if (!cd || !cd.items) return false;
  const images: Array<{ blob: Blob; ext: string }> = [];
  for (let i = 0; i < cd.items.length; i++) {
    const item = cd.items[i];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) images.push({ blob: f, ext: extFromName(f.name) || extFromMime(item.type) });
    }
  }
  if (images.length === 0) return false;
  event.preventDefault();
  for (const img of images) {
    const bytes = await readFileAsUint8(img.blob);
    const text = await saveOrUploadText(bytes, img.ext, opts);
    if (text) insert(text);
  }
  return true;
}

/**
 * Blocking variant of `saveAndInsert` for the plain-textarea editor: saves
 * locally, or (if an uploader is configured with auto-upload) uploads and
 * returns the hosted URL — falling back to a local link on failure. Awaits the
 * upload before returning (no placeholder, unlike the CodeMirror path).
 */
export async function saveOrUploadText(
  bytes: Uint8Array,
  ext: string,
  opts: ImagePasteOptions,
): Promise<string | null> {
  const filename = makeFilename(ext);
  const up = opts.getUploader ? opts.getUploader(filename) : null;
  const local = await prepareLocalTarget(filename, opts);
  if (!up || !up.onPaste) {
    if (await writeBytes(local.fullPath, bytes)) return local.insertText;
    reportFailure(opts, `could not write ${local.fullPath}`);
    return null;
  }
  let srcPath: string;
  if (up.keepLocal) {
    if (!(await writeBytes(local.fullPath, bytes))) {
      reportFailure(opts, `could not write ${local.fullPath}`);
      return null;
    }
    srcPath = local.fullPath;
  } else {
    const temp = await prepareTempTarget(filename, opts);
    if (!(await writeBytes(temp, bytes))) {
      return (await writeBytes(local.fullPath, bytes)) ? local.insertText : null;
    }
    srcPath = temp;
  }
  return performUpload(up, srcPath, opts, async () => {
    if (up.keepLocal) return local.insertText;
    try {
      await fsPort.copyFile({ src: srcPath, dst: local.fullPath });
      return local.insertText;
    } catch {
      return markdownImage(srcPath.replace(/\\/g, '/'));
    }
  });
}

/**
 * The markdown to insert for an image file on disk, for editors without a
 * CodeMirror view (the Windows plain textarea editors). Copies the file into
 * the attachments folder like {@link insertImageFromPath}, uploads it when an
 * uploader is set to run on paste, and returns the link — or null if the copy
 * failed. Before this existed, dropping an image file onto the Windows editor
 * inserted the bare file path as text.
 */
export async function imageTextFromPath(
  srcPath: string,
  opts: ImagePasteOptions,
): Promise<string | null> {
  if (isContentUri(srcPath)) {
    let bytes: Uint8Array;
    try {
      bytes = await readContentUri(srcPath);
    } catch (err) {
      reportFailure(opts, err);
      return null;
    }
    return saveOrUploadText(bytes, sniffImageExt(bytes) || extFromName(srcPath) || 'png', opts);
  }
  const ext = extFromName(srcPath) || 'png';
  const filename = makeFilename(ext);
  const up = opts.getUploader ? opts.getUploader(filename) : null;
  const local = await prepareLocalTarget(filename, opts);
  const copyLocal = async (): Promise<boolean> => {
    try {
      await fsPort.copyFile({ src: srcPath, dst: local.fullPath });
      return true;
    } catch (err) {
      reportFailure(opts, err);
      return false;
    }
  };
  if (!up || !up.onPaste) return (await copyLocal()) ? local.insertText : null;
  let uploadSrc = srcPath;
  if (up.keepLocal) {
    if (!(await copyLocal())) return null;
    uploadSrc = local.fullPath;
  }
  return performUpload(up, uploadSrc, opts, async () => {
    if (up.keepLocal) return local.insertText;
    return (await copyLocal()) ? local.insertText : markdownImage(srcPath.replace(/\\/g, '/'));
  });
}
