import type { ResolvedUploader } from './image-upload.ts';

export interface ImagePasteOptions {
  getFilePath: () => string | undefined;
  /** Current document content, used to read front-matter `imageRoot`. */
  getDocContent?: () => string;
  /** Override temp directory (mainly for tests). */
  tempDir?: string;
  /** image-host uploader resolved for a target filename, or null to
   *  save locally only. When present and `.onPaste` is true, pasted/dropped
   *  images are uploaded and the returned URL is inserted (with a local
   *  fallback on failure). */
  getUploader?: (filename: string) => ResolvedUploader | null;
  /** Surface upload progress/results to the user (wired to toasts + i18n by
   *  the editor). `key` is an i18n key under `toast.*`. */
  notify?: (
    kind: 'info' | 'success' | 'error',
    key: string,
    params?: Record<string, unknown>,
  ) => void;
  /** v4.3.5 — `shared` (`_assets/`) vs `per-file` (`<stem>.assets/`).
   *  Defaults to `shared` if absent (back-compat for callers that haven't
   *  been updated yet). */
  getAttachmentMode?: () => 'shared' | 'per-file' | 'custom';
  /** #88 — folder name for the `shared` attachment mode (default `_assets`).
   *  `per-file` mode always uses `<stem>.assets/` regardless of this. */
  getAssetsDirName?: () => string;
  /** #7 — Typora-style path template for the `custom` attachment mode.
   *  Supports `${filename}` (note stem). Relative templates resolve against
   *  the note's folder; absolute paths are used as-is. */
  getCustomPath?: () => string;
}
