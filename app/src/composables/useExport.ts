import { fsPort, dialogPort, pathPort } from '../platform/index.ts';
import { isIOS } from '../lib/platform';
import { exportDefaultPath } from '../lib/export-paths';
import { useI18n } from '../i18n';
import { useTabsStore } from '../stores/tabs';
import { useSettingsStore } from '../stores/settings';
import { useToastsStore } from '../stores/toasts';
import { track } from '../lib/telemetry';
import { resolvePdfOptions, userTouchedPdfDefaults } from '../lib/pdf-options';
import { getEditorSelectionMd } from './export/selection-source.ts';
import { buildStandaloneHtml, markdownToDocxBlob, markdownToPdfBlob, markdownToImageBlob } from './export/lazy-exporters.ts';
import { iosSavedToast, type ActiveDocument } from './export/export-shared.ts';
import { createPrintPdfExporter } from './export/print-pdf.ts';
import { createCopyActions } from './export/copy-actions.ts';

export function useExport() {
  const tabs = useTabsStore();
  const toasts = useToastsStore();
  const settings = useSettingsStore();
  const { t } = useI18n();

  function activeOr(): ActiveDocument | null {
    const tab = tabs.activeTab;
    if (!tab) {
      toasts.error('No active document');
      return null;
    }
    // Tolerate stale persisted state from older versions where the
    // field was named `title` instead of `fileName`.
    const name = (tab as { fileName?: string; title?: string }).fileName
      ?? (tab as { title?: string }).title
      ?? 'Untitled';
    return {
      content: tab.content ?? '',
      baseName: name.replace(/\.[^.]+$/, ''),
      filePath: tab.filePath,
    };
  }

  // iOS save flow: Tauri's saveDialog returns a `file:///…` URL that
  // `write_file` can't write to (Rust's `std::fs::write` treats the URL
  // literally → ENOENT; even if we strip `file://`, security-scoped paths
  // outside our sandbox are unreachable without NSURL's
  // startAccessingSecurityScopedResource). Instead, on iOS we write to the
  // app's own Documents directory — UIFileSharingEnabled + LSSupports
  // OpeningDocumentsInPlace surface that folder under "On My iPhone › SoloMD"
  // in the Files app, so users can move/iCloud-sync from there.
  async function pickWritePath(
    filename: string,
    filters: { name: string; extensions: string[] }[],
  ): Promise<string | null> {
    if (isIOS()) {
      const dir = await pathPort.documentDir();
      return await pathPort.join(dir, filename);
    }
    // #260 — start in the document's own folder instead of wherever the
    // last save happened. Falls back to a bare filename for unsaved
    // buffers and virtual (SAF) paths, which is the old behaviour.
    const defaultPath = exportDefaultPath(activeOr()?.filePath, filename) ?? filename;
    return await dialogPort.save({ defaultPath, filters });
  }

  async function exportHtml() {
    track('file_exported', { format: 'html' });
    const ctx = activeOr();
    if (!ctx) return;
    const filename = `${ctx.baseName}.html`;
    const path = await pickWritePath(filename, [{ name: 'HTML', extensions: ['html'] }]);
    if (!path) return;
    const tid = toasts.info('Exporting HTML…', 0);
    try {
      const html = await buildStandaloneHtml({
        content: ctx.content,
        title: ctx.baseName,
        filePath: ctx.filePath,
        plantumlServer: settings.plantumlEnabled ? settings.plantumlServer : null,
      });
      toasts.dismiss(tid);
      await fsPort.writeFile({ path, content: html, encoding: 'UTF-8' });
      toasts.success(isIOS() ? iosSavedToast(filename) : 'Exported to HTML');
    } catch (e) {
      toasts.dismiss(tid);
      toasts.error(`Export failed: ${e}`);
    }
  }

  async function exportDocx() {
    track('file_exported', { format: 'docx' });
    const ctx = activeOr();
    if (!ctx) return;
    const filename = `${ctx.baseName}.docx`;
    const path = await pickWritePath(filename, [{ name: 'Word Document', extensions: ['docx'] }]);
    if (!path) return;
    try {
      const blob = await markdownToDocxBlob(
        ctx.content,
        ctx.baseName,
        ctx.filePath,
        settings.docxPreset,
        t('docx.contents'),
      );
      const buffer = new Uint8Array(await blob.arrayBuffer());
      // Tauri 2 serializes Uint8Array as a number array which Rust accepts as Vec<u8>.
      await fsPort.writeBinaryFile({ path, data: Array.from(buffer) });
      toasts.success(isIOS() ? iosSavedToast(filename) : 'Exported to DOCX');
    } catch (e) {
      console.error(e);
      toasts.error(`DOCX export failed: ${e}`);
    }
  }

  /** Native-feel PDF export: build a real .pdf file via html2pdf.js. */
  async function exportPdf() {
    track('file_exported', { format: 'pdf' });
    const ctx = activeOr();
    if (!ctx) return;
    const filename = `${ctx.baseName}.pdf`;
    const path = await pickWritePath(filename, [{ name: 'PDF', extensions: ['pdf'] }]);
    if (!path) return;
    const tid = toasts.info('Generating PDF…', 0);
    try {
      const pdfOpts = resolvePdfOptions(
        settings.pdfDefaults,
        ctx.content,
        userTouchedPdfDefaults(settings.pdfDefaults),
      );
      const blob = await markdownToPdfBlob(ctx.content, ctx.baseName, pdfOpts, ctx.filePath);
      const buffer = new Uint8Array(await blob.arrayBuffer());
      await fsPort.writeBinaryFile({ path, data: Array.from(buffer) });
      toasts.dismiss(tid);
      toasts.success(isIOS() ? iosSavedToast(filename) : 'Exported to PDF');
    } catch (e) {
      console.error(e);
      toasts.dismiss(tid);
      toasts.error(`PDF export failed: ${e}`);
    }
  }

  /**
   * Export as PNG image (renders preview, captures with html2canvas).
   * Honors the active editor selection — matches `copyAsImage` so "select
   * region, save as image" produces an image of *just that region* instead
   * of the whole document.
   */
  async function exportImage() {
    track('file_exported', { format: 'image' });
    const ctx = activeOr();
    if (!ctx) return;
    const sel = getEditorSelectionMd(ctx.content);
    const source = sel ?? ctx.content;
    const isSelection = sel !== null;
    const filename = isSelection
      ? `${ctx.baseName}-selection.png`
      : `${ctx.baseName}.png`;
    const path = await pickWritePath(filename, [{ name: 'PNG Image', extensions: ['png'] }]);
    if (!path) return;
    const tid = toasts.info(isSelection ? 'Generating selection image…' : 'Generating image…', 0);
    try {
      const blob = await markdownToImageBlob(source, ctx.baseName, ctx.filePath, {
        branding: settings.imageExportBranding,
      });
      const buffer = new Uint8Array(await blob.arrayBuffer());
      await fsPort.writeBinaryFile({ path, data: Array.from(buffer) });
      toasts.dismiss(tid);
      const msg = isIOS()
        ? iosSavedToast(filename)
        : isSelection
          ? 'Exported selection to PNG image'
          : 'Exported to PNG image';
      toasts.success(msg);
    } catch (e) {
      console.error(e);
      toasts.dismiss(tid);
      toasts.error(`Image export failed: ${e}`);
    }
  }

  const exportPdfPrint = createPrintPdfExporter({ activeOr, settings, toasts, t });
  const { copyAsHtml, copyAsPlainText, copyAsMarkdown, copyAsImage } = createCopyActions({ activeOr, pickWritePath, settings, toasts });

  return {
    exportHtml,
    exportDocx,
    exportPdf,
    exportPdfPrint,
    exportImage,
    copyAsHtml,
    copyAsPlainText,
    copyAsMarkdown,
    copyAsImage,
    pickWritePath,
  };
}
