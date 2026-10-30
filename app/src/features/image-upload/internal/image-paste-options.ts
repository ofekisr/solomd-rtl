import type { EditorFeatureContext } from '../../editor/contracts/index.ts';
import type { ImagePasteOptions } from '../../../lib/cm-image-paste.ts';
import { resolveUploader, type ImageUploadSettings } from '../../../lib/image-upload.ts';

export function imagePasteOptionsFor(ctx: EditorFeatureContext): ImagePasteOptions {
  const settings = ctx.settings;
  return {
    getFilePath: () => ctx.tab().filePath,
    getDocContent: () => ctx.tab().content,
    getAttachmentMode: () => settings.attachmentMode,
    getAssetsDirName: () => settings.assetsDirName,
    getCustomPath: () => settings.attachmentCustomPath,
    getUploader: (filename: string) =>
      resolveUploader(settings as unknown as ImageUploadSettings, filename),
    notify: (kind, key, params) => {
      const msg = ctx.t(key, params as Record<string, string | number>);
      if (kind === 'success') ctx.toast.success(msg);
      else if (kind === 'error') ctx.toast.error(msg);
      else ctx.toast.info(msg);
    },
  };
}
