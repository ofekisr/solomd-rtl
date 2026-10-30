import { fsPort, pathPort } from '../../../platform/index.ts';
import { uploadImage, type ResolvedUploader } from './image-upload.ts';
import { markdownImage } from '../../../lib/md-image-url.ts';
import { isSafPath } from '../../../lib/image/source.ts';
import type { ImagePasteOptions } from './image-paste-types.ts';
import { dirnameOf, joinPath, parseImageRootFast, resolveAssetsDir } from './image-paths.ts';

export async function resolveTempDir(override?: string): Promise<string> {
  if (override) return override;
  try {
    return await pathPort.tempDir();
  } catch {
    return '/tmp';
  }
}

/** #349 — bytes of an Android `content://` URI, through the fs plugin's
 *  ContentResolver bridge (the same one #148 uses to open notes). */
export async function readContentUri(uri: string): Promise<Uint8Array> {
  return pathPort.readFile(uri);
}

export function reportFailure(opts: ImagePasteOptions, err: unknown): void {
  console.error('[cm-image-paste] image insert failed', err);
  opts.notify?.('error', 'toast.imageInsertFailed', { error: String(err) });
}

export async function readFileAsUint8(file: File | Blob): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

export function getSep(): string {
  try {
    return pathPort.sep();
  } catch {
    return '/';
  }
}

/**
 * Compute where a new image with `filename` should live locally, and the
 * markdown link to insert for it — based on front-matter `imageRoot`, the
 * attachment mode, or (no file path) the temp dir. Pure-ish: only touches
 * `sep()` / `tempDir()`. Shared by the local-save and upload paths.
 */
export async function prepareLocalTarget(
  filename: string,
  opts: ImagePasteOptions,
): Promise<{ fullPath: string; insertText: string }> {
  const sepCh = getSep();
  const filePath = opts.getFilePath();
  const imageRoot = opts.getDocContent ? parseImageRootFast(opts.getDocContent()) : null;

  // #349 — a note in a SAF vault has a `saf:<documentId>` path. Joining
  // `_assets/` onto it gives a string that no filesystem call can write, so
  // the image was silently lost. SAF can't store binary files yet: keep the
  // image in SoloMD's own Documents folder and link it by absolute path
  // (the asset protocol scope covers it, so it renders), and say so.
  if (isSafPath(filePath)) {
    let base: string;
    try {
      base = await pathPort.documentDir();
    } catch {
      base = await resolveTempDir(opts.tempDir);
    }
    const fullPath = joinPath(joinPath(base, '_assets', sepCh), filename, sepCh);
    opts.notify?.('info', 'toast.imageSavedOutsideVault');
    return { fullPath, insertText: markdownImage(fullPath.replace(/\\/g, '/')) };
  }

  if (imageRoot && filePath) {
    const rootAbs = imageRoot.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(imageRoot);
    const rootDir = rootAbs ? imageRoot : joinPath(dirnameOf(filePath, sepCh), imageRoot, sepCh);
    return { fullPath: joinPath(rootDir, filename, sepCh), insertText: markdownImage(filename) };
  }
  if (filePath) {
    const mode = opts.getAttachmentMode ? opts.getAttachmentMode() : 'shared';
    const sharedDir = opts.getAssetsDirName ? opts.getAssetsDirName() || '_assets' : '_assets';
    const customPath = opts.getCustomPath ? opts.getCustomPath() : undefined;
    const { dir: assetsDir, urlPrefix } = resolveAssetsDir(filePath, sepCh, mode, sharedDir, customPath);
    return {
      fullPath: joinPath(assetsDir, filename, sepCh),
      insertText: markdownImage(`${urlPrefix}/${filename}`),
    };
  }
  const t = await resolveTempDir(opts.tempDir);
  const fullPath = joinPath(joinPath(t, 'solomd', sepCh), filename, sepCh);
  // Forward slashes in the markdown URL — markdown-it eats `\` as escapes on
  // Windows, mangling the preview src. (No-op on macOS/Linux.)
  return { fullPath, insertText: markdownImage(fullPath.replace(/\\/g, '/')) };
}

/** Temp path for an image we only need transiently (upload source when not
 *  keeping a local copy). */
export async function prepareTempTarget(
  filename: string,
  opts: ImagePasteOptions,
): Promise<string> {
  const sepCh = getSep();
  const t = await resolveTempDir(opts.tempDir);
  return joinPath(joinPath(t, 'solomd', sepCh), filename, sepCh);
}

export async function writeBytes(fullPath: string, bytes: Uint8Array): Promise<boolean> {
  try {
    await fsPort.writeBinaryFile({ path: fullPath, data: Array.from(bytes) });
    return true;
  } catch (err) {
    console.error('[cm-image-paste] failed to write image', err);
    return false;
  }
}

/**
 * Upload `srcPath` via the resolved uploader and return the markdown to insert:
 * `![](url)` on success, or `fallback()` (a local link) on failure. Emits
 * info/success/error toasts via `opts.notify`.
 */
export async function performUpload(
  up: ResolvedUploader,
  srcPath: string,
  opts: ImagePasteOptions,
  fallback: () => Promise<string>,
): Promise<string> {
  opts.notify?.('info', 'toast.imageUploading');
  try {
    const url = await uploadImage(up.cfg, srcPath);
    opts.notify?.('success', 'toast.imageUploaded');
    return markdownImage(url);
  } catch (err) {
    console.error('[cm-image-paste] upload failed', err);
    opts.notify?.('error', 'toast.imageUploadFailed');
    return await fallback();
  }
}
