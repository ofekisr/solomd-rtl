import type { EditorFeatureContext } from '../../editor/contracts/index.ts';
import { resolveUploader, uploadImage, type ImageUploadSettings } from '../../../lib/image-upload.ts';
import { imageSrcChanges, localImageSources, parseFrontMatterImageRoot } from './image-links.ts';

async function resolveLocalImageAbsPath(ctx: EditorFeatureContext, src: string): Promise<string | null> {
  const { resolveImagePath } = await import('../../../lib/image-resolve.ts');
  const imageRoot = parseFrontMatterImageRoot(ctx.tab().content) ?? null;
  const abs = resolveImagePath(src, imageRoot, ctx.tab().filePath);
  return abs || null;
}

function replaceAllImageSrc(ctx: EditorFeatureContext, oldSrc: string, newUrl: string): void {
  const view = ctx.view();
  if (!view) return;
  const changes = imageSrcChanges(view.state.doc.toString(), oldSrc, newUrl);
  if (changes.length) view.dispatch({ changes });
}

async function uploadOne(ctx: EditorFeatureContext, src: string): Promise<'uploaded' | 'skipped' | 'stop'> {
  const abs = await resolveLocalImageAbsPath(ctx, src);
  if (!abs) return 'skipped';
  const filename = abs.split(/[\\/]/).pop() || 'image.png';
  const resolved = resolveUploader(ctx.settings as unknown as ImageUploadSettings, filename);
  if (!resolved) return 'stop';
  const url = await uploadImage(resolved.cfg, abs);
  replaceAllImageSrc(ctx, src, url);
  return 'uploaded';
}

export async function uploadLocalImages(ctx: EditorFeatureContext): Promise<void> {
  const view = ctx.view();
  if (!view) return;
  const up0 = resolveUploader(ctx.settings as unknown as ImageUploadSettings, 'x.png');
  if (ctx.settings.imageUploader === 'none' || !up0) {
    ctx.toast.info(ctx.t('toast.noUploaderConfigured'));
    return;
  }
  const targets = localImageSources(view.state.doc.toString());
  if (targets.length === 0) {
    ctx.toast.info(ctx.t('toast.noLocalImages'));
    return;
  }
  let done = 0;
  let uploaded = 0;
  for (const src of targets) {
    done++;
    ctx.toast.info(ctx.t('toast.uploadingProgress', { done, total: targets.length }));
    try {
      const outcome = await uploadOne(ctx, src);
      if (outcome === 'stop') break;
      if (outcome === 'uploaded') uploaded++;
    } catch (err) {
      console.error('[Editor] uploadLocalImages failed for', src, err);
    }
  }
  if (uploaded > 0) ctx.toast.success(ctx.t('toast.uploadedCount', { n: uploaded }));
  else ctx.toast.error(ctx.t('toast.imageUploadFailedShort'));
}
