import type { EditorFeature } from '../../editor/contracts/index.ts';
import { imagePasteExtension, insertImageFromPath } from '../internal/cm-image-paste.ts';
import { markdownImage } from '../../../lib/md-image-url.ts';
import { imagePasteOptionsFor } from '../internal/image-paste-options.ts';
import { uploadLocalImages } from '../internal/upload-local-images.ts';

export const IMAGE_UPLOAD_SETTINGS_KEYS = [
  'attachmentMode', 'assetsDirName', 'attachmentCustomPath', 'imageUploader',
  'imageUploadOnPaste', 'imageUploadKeepLocal', 'picgoEndpoint', 'imageUploadCommand', 'smmsToken',
  's3Endpoint', 's3Region', 's3Bucket', 's3AccessKeyId', 's3SecretAccessKey', 's3PathPrefix',
  's3CustomDomain', 's3UsePathStyle', 'ghImageRepo', 'ghImageBranch', 'ghImageToken',
  'ghImagePathPrefix', 'ghImageCdn',
] as const;

export function createImageUploadFeature(): EditorFeature {
  return {
    id: 'image-upload',
    settingsKeys: IMAGE_UPLOAD_SETTINGS_KEYS,
    i18nKeys: [
      'toast.noUploaderConfigured', 'toast.noLocalImages', 'toast.uploadingProgress',
      'toast.uploadedCount', 'toast.imageUploadFailedShort',
    ],
    extensions: { 'image-paste': (ctx) => imagePasteExtension(imagePasteOptionsFor(ctx)) },
    commands: {
      insertImageFromPath: async (ctx, srcPath) => {
        const view = ctx.view();
        if (!view) return;
        await insertImageFromPath(view, String(srcPath), imagePasteOptionsFor(ctx));
      },
      insertImageUrl: (ctx, url, alt = '') => {
        const clean = String(url ?? '').trim();
        if (!clean || !ctx.view()) return;
        ctx.run('insertMarkdown', markdownImage(clean, String(alt)));
      },
      uploadLocalImages: (ctx) => uploadLocalImages(ctx),
    },
  };
}
