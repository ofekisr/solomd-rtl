import { clipboardPort, fsPort } from '../../platform/index.ts';
import { isIOS } from '../../lib/platform';
import { renderMarkdown } from '../../lib/markdown/markdown';
import type { useSettingsStore } from '../../stores/settings';
import type { useToastsStore } from '../../stores/toasts';
import { getEditorSelectionMd } from './selection-source.ts';
import { stripMarkdown } from './strip-markdown.ts';
import { markdownToImageBlob } from './lazy-exporters.ts';
import { hasNativeClipboardWrite, iosSavedToast, type ActiveDocument } from './export-shared.ts';

export interface CopyActionsDeps {
  activeOr: () => ActiveDocument | null;
  pickWritePath: (filename: string, filters: { name: string; extensions: string[] }[]) => Promise<string | null>;
  settings: ReturnType<typeof useSettingsStore>;
  toasts: ReturnType<typeof useToastsStore>;
}

export function createCopyActions({ activeOr, pickWritePath, settings, toasts }: CopyActionsDeps) {
  /**
   * Source for "Copy as X" — the editor selection if present, else the
   * whole active document. Returns the source plus a flag callers use to
   * customize the success toast.
   */
  function copySource(): { source: string; isSelection: boolean } | null {
    const ctx = activeOr();
    if (!ctx) return null;
    const sel = getEditorSelectionMd(ctx.content);
    return sel !== null
      ? { source: sel, isSelection: true }
      : { source: ctx.content, isSelection: false };
  }

  async function copyAsHtml() {
    const src = copySource();
    if (!src) return;
    const html = renderMarkdown(src.source);
    const okMsg = src.isSelection ? 'Copied selection as HTML' : 'Copied as HTML';
    // Native Clipboard API first — supports rich HTML on all desktops and on
    // iOS 16+. Tauri's `writeHtml` is unimplemented on iOS so we'd otherwise
    // fall through to plain text and lose formatting.
    if (hasNativeClipboardWrite()) {
      try {
        const item = new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([src.source], { type: 'text/plain' }),
        });
        await navigator.clipboard.write([item]);
        toasts.success(okMsg);
        return;
      } catch {
        // fall through to the port save-as
      }
    }
    try {
      await clipboardPort.writeHtml(html);
      toasts.success(okMsg);
    } catch (e) {
      // Fallback: write plain HTML string as text
      try {
        await clipboardPort.writeText(html);
        toasts.success(src.isSelection ? 'Copied selection HTML source' : 'Copied HTML source');
      } catch (e2) {
        toasts.error(`Copy failed: ${e2}`);
      }
    }
  }

  async function copyAsPlainText() {
    const src = copySource();
    if (!src) return;
    const text = stripMarkdown(src.source);
    const okMsg = src.isSelection ? 'Copied selection as plain text' : 'Copied as plain text';
    try {
      await clipboardPort.writeText(text);
      toasts.success(okMsg);
    } catch (e) {
      toasts.error(`Copy failed: ${e}`);
    }
  }

  async function copyAsMarkdown() {
    const src = copySource();
    if (!src) return;
    const okMsg = src.isSelection ? 'Copied selection as Markdown' : 'Copied as Markdown';
    try {
      await clipboardPort.writeText(src.source);
      toasts.success(okMsg);
    } catch (e) {
      toasts.error(`Copy failed: ${e}`);
    }
  }

  /** Copy rendered markdown as a PNG image to the clipboard. */
  async function copyAsImage() {
    const ctx = activeOr();
    if (!ctx) return;
    const sel = getEditorSelectionMd(ctx.content);
    const source = sel ?? ctx.content;
    const isSelection = sel !== null;
    const tid = toasts.info(isSelection ? 'Capturing selection…' : 'Capturing image…', 0);
    try {
      const blob = await markdownToImageBlob(source, ctx.baseName, ctx.filePath, {
        branding: settings.imageExportBranding,
      });

      // Native Clipboard API supports `image/png` on iOS 16+ and all
      // desktops. Tauri's `writeImage` is unimplemented on iOS so we'd
      // otherwise fall through to the save-as fallback.
      if (hasNativeClipboardWrite()) {
        try {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          toasts.dismiss(tid);
          toasts.success(isSelection ? 'Copied selection as image' : 'Copied as image');
          return;
        } catch {
          // fall through to the port save-as
        }
      }

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const img = await clipboardPort.imageFromBytes(bytes);
      await clipboardPort.writeImage(img);
      toasts.dismiss(tid);
      toasts.success(isSelection ? 'Copied selection as image' : 'Copied as image');
    } catch (e) {
      console.error(e);
      toasts.dismiss(tid);
      // Fallback: save to file instead
      try {
        const filename = `${ctx.baseName}.png`;
        const path = await pickWritePath(filename, [{ name: 'PNG Image', extensions: ['png'] }]);
        if (path) {
          const blob2 = await markdownToImageBlob(source, ctx.baseName, ctx.filePath, {
            branding: settings.imageExportBranding,
          });
          const buffer = new Uint8Array(await blob2.arrayBuffer());
          await fsPort.writeBinaryFile({ path, data: Array.from(buffer) });
          toasts.success(isIOS() ? iosSavedToast(filename) : 'Clipboard failed — saved as PNG instead');
        } else {
          toasts.error(`Copy image failed: ${e}`);
        }
      } catch (e2) {
        toasts.error(`Copy image failed: ${e}`);
      }
    }
  }


  return { copyAsHtml, copyAsPlainText, copyAsMarkdown, copyAsImage };
}
