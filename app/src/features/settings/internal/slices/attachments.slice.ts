import { z } from 'zod';
import type { SettingsSlice } from '../../contracts/index.ts';

export type AttachmentsSettings = {
  /** v4.3.5 — where to write images pasted/dropped into the editor.
   *  - `shared` (default): one `_assets/` folder per directory. All notes in
   *    that dir share it. Matches pre-v4.3.5 behavior; safe for legacy vaults.
   *  - `per-file`: each note gets its own `<basename>.assets/` folder next to
   *    the .md. Moving / renaming the note moves the folder with it
   *    (handled in `fs_rename` on the Rust side, which also rewrites
   *    `<oldStem>.assets/...` link refs inside the file body when the stem
   *    changes). Better when notes get reshuffled often; clutters the file
   *    tree if every note has images. Issue: user feedback 2026-05-26.
   */
  attachmentMode: 'shared' | 'per-file' | 'custom';
  // #7 — Typora-style custom path template for `custom` attachment mode.
  // Supports `${filename}` (the note's name without extension). Relative
  // templates (`./images/${filename}/`, `assets/`) resolve against the note's
  // folder; an absolute path is used as-is. Default mirrors Typora's default.
  attachmentCustomPath: string;
  // #88 — folder name for `shared` attachment mode (default `_assets`). Used
  // only when attachmentMode is 'shared'; per-file mode always uses
  // `<stem>.assets/`. Empty string falls back to `_assets`.
  assetsDirName: string;
  // ── Image upload (external image hosting) ───────────────────────────
  // Like Typora / MarkText: instead of (or alongside) copying a pasted/dropped
  // image into the local attachments folder, upload it to an image host and
  // insert the returned URL. `none` = current local-only behavior. The actual
  // upload runs in the Rust `upload_image` command; the per-backend fields below
  // are forwarded to it. See `lib/image-upload.ts` for the config builder.
  imageUploader: 'none' | 'picgo' | 'command' | 'smms' | 's3' | 'github';
  // Auto-upload pasted/dropped images. When false, images still save locally and
  // the user uploads later via the command palette ("Upload local images…").
  imageUploadOnPaste: boolean;
  // Keep a local copy in the attachments folder too (link still points at the
  // uploaded URL). When false, only a temp copy is made for the upload.
  imageUploadKeepLocal: boolean;
  // PicGo app's built-in HTTP server endpoint.
  picgoEndpoint: string;
  // Custom uploader command template; `{path}` is replaced with the image file.
  imageUploadCommand: string;
  // SM.MS API token (optional; empty = anonymous upload).
  smmsToken: string;
  // S3-compatible (AWS S3 / Aliyun OSS / Tencent COS / Cloudflare R2 / MinIO).
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  s3PathPrefix: string;
  s3CustomDomain: string;
  s3UsePathStyle: boolean;
  // GitHub repo as an image host (served via raw.githubusercontent or jsDelivr).
  ghImageRepo: string;
  ghImageBranch: string;
  ghImageToken: string;
  ghImagePathPrefix: string;
  ghImageCdn: 'raw' | 'jsdelivr';
};

const schema = z.object({
  attachmentMode: z.enum(['shared', 'per-file', 'custom']),
  attachmentCustomPath: z.string(),
  assetsDirName: z.string(),
  imageUploader: z.enum(['none', 'picgo', 'command', 'smms', 's3', 'github']),
  imageUploadOnPaste: z.boolean(),
  imageUploadKeepLocal: z.boolean(),
  picgoEndpoint: z.string(),
  imageUploadCommand: z.string(),
  smmsToken: z.string(),
  s3Endpoint: z.string(),
  s3Region: z.string(),
  s3Bucket: z.string(),
  s3AccessKeyId: z.string(),
  s3SecretAccessKey: z.string(),
  s3PathPrefix: z.string(),
  s3CustomDomain: z.string(),
  s3UsePathStyle: z.boolean(),
  ghImageRepo: z.string(),
  ghImageBranch: z.string(),
  ghImageToken: z.string(),
  ghImagePathPrefix: z.string(),
  ghImageCdn: z.enum(['raw', 'jsdelivr']),
});

function defaults(): AttachmentsSettings {
  return {
    attachmentMode: 'shared',
    attachmentCustomPath: './images/${filename}/',
    assetsDirName: '_assets',
    imageUploader: 'none',
    imageUploadOnPaste: true,
    imageUploadKeepLocal: false,
    picgoEndpoint: 'http://127.0.0.1:36677/upload',
    imageUploadCommand: '',
    smmsToken: '',
    s3Endpoint: '',
    s3Region: 'us-east-1',
    s3Bucket: '',
    s3AccessKeyId: '',
    s3SecretAccessKey: '',
    s3PathPrefix: 'images/',
    s3CustomDomain: '',
    s3UsePathStyle: false,
    ghImageRepo: '',
    ghImageBranch: 'main',
    ghImageToken: '',
    ghImagePathPrefix: 'images/',
    ghImageCdn: 'jsdelivr',
  };
}

export const attachmentsSlice: SettingsSlice<AttachmentsSettings> = {
  id: 'attachments',
  schema,
  defaults,
};
