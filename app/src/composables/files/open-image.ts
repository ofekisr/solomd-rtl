import { pathPort } from '../../platform/index.ts';
import { openImageOverlay, type OverlayStrings } from '../../lib/image-overlay';
import type { FilesCtx } from './files-ctx.ts';

export function createImageOpener(ctx: FilesCtx) {
  const { workspace, toasts, t } = ctx;

  function overlayStrings(): OverlayStrings {
    return {
      close: t('overlay.close'),
      zoomIn: t('overlay.zoomIn'),
      zoomOut: t('overlay.zoomOut'),
      resetZoom: t('overlay.resetZoom'),
      image: t('overlay.image'),
      diagram: t('overlay.diagram'),
    };
  }

  // #98 — open an image file in the fullscreen overlay viewer. Mirrors the
  // click-to-zoom flow in Preview.vue: build an <img> from an asset:// URL
  // and hand it to openImageOverlay(). We wait for the image to load so the
  // overlay's fit-to-screen sees real natural dimensions.
  async function openImageFile(path: string) {
    const fileName = path.split(/[\\/]/).pop() ?? path;
    try {
      const img = new Image();
      img.src = pathPort.convertFileSrc(path);
      img.alt = fileName;
      await new Promise<void>((resolve, reject) => {
        if (img.complete && img.naturalWidth > 0) return resolve();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('image failed to load'));
      });
      openImageOverlay({ source: img, title: fileName, strings: overlayStrings() });
      workspace.pushRecent(path);
      toasts.success(`Opened ${fileName}`);
    } catch (e) {
      console.error('open image failed', e);
      toasts.error(`Failed to open image: ${e}`);
    }
  }

  return openImageFile;
}
