import type { Settings } from '../settings-types.ts';
import type { SettingsThis } from './settings-this.ts';

export const attachmentsActions = {
  /** v4.3.5 — flip between `shared` (`_assets/`) and `per-file`
   *  (`<basename>.assets/`) attachment storage layouts. */
  setAttachmentMode(this: SettingsThis, mode: 'shared' | 'per-file' | 'custom') {
    this.attachmentMode =
      mode === 'per-file' ? 'per-file' : mode === 'custom' ? 'custom' : 'shared';
    this.persist();
  },
  // #7 — Typora-style custom path template (used when attachmentMode==='custom').
  setAttachmentCustomPath(this: SettingsThis, tpl: string) {
    const cleaned = (tpl || '').trim();
    this.attachmentCustomPath = cleaned || './images/${filename}/';
    this.persist();
  },
  setAssetsDirName(this: SettingsThis, name: string) {
    // Strip slashes/backslashes — the path is joined by the image-paste
    // helper using the platform separator, so a name with separators would
    // create nested folders or break URL prefixes. Trim whitespace; fall
    // back to the default when empty.
    const cleaned = (name || '').replace(/[\\/]/g, '').trim();
    this.assetsDirName = cleaned || '_assets';
    this.persist();
  },
  /** Image-upload config. One generic patch action — the Settings
   *  panel binds each field through it. Only whitelisted keys are accepted so
   *  a stray key can't pollute the persisted blob. */
  setImageUpload(
    this: SettingsThis,
    patch: Partial<
      Pick<
        Settings,
        | 'imageUploader'
        | 'imageUploadOnPaste'
        | 'imageUploadKeepLocal'
        | 'picgoEndpoint'
        | 'imageUploadCommand'
        | 'smmsToken'
        | 's3Endpoint'
        | 's3Region'
        | 's3Bucket'
        | 's3AccessKeyId'
        | 's3SecretAccessKey'
        | 's3PathPrefix'
        | 's3CustomDomain'
        | 's3UsePathStyle'
        | 'ghImageRepo'
        | 'ghImageBranch'
        | 'ghImageToken'
        | 'ghImagePathPrefix'
        | 'ghImageCdn'
      >
    >,
  ) {
    const keys: (keyof Settings)[] = [
      'imageUploader', 'imageUploadOnPaste', 'imageUploadKeepLocal',
      'picgoEndpoint', 'imageUploadCommand', 'smmsToken',
      's3Endpoint', 's3Region', 's3Bucket', 's3AccessKeyId',
      's3SecretAccessKey', 's3PathPrefix', 's3CustomDomain', 's3UsePathStyle',
      'ghImageRepo', 'ghImageBranch', 'ghImageToken', 'ghImagePathPrefix', 'ghImageCdn',
    ];
    const target = this as unknown as Record<string, unknown>;
    const source = patch as Record<string, unknown>;
    for (const k of keys) {
      if (k in patch && source[k] !== undefined) target[k] = source[k];
    }
    this.persist();
  },
};
