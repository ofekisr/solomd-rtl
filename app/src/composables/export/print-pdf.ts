import { convertPort } from '../../platform/index.ts';
import { isWindowsDesktop } from '../../lib/platform';
import { renderMarkdown, extractImageRoot } from '../../lib/markdown';
// Tiny shim: the mermaid bundle itself stays behind a dynamic import inside
// it, so touching this module costs nothing at startup.
import { initMermaid } from '../../lib/mermaid-lazy';
import { renderGraphvizBlocks } from '../../lib/graphviz';
import { mountPrintOverlay } from '../../lib/print-overlay';
import {
  decoratePrintToc,
  fillTocPageNumbers,
  printableBox,
  withPrintPagination,
} from '../../lib/print-pages';
import { rewriteLinkUrls, rewriteImageUrls } from '../../lib/image-resolve';
import { useThemeStore } from '../../stores/theme';
import { track } from '../../lib/telemetry';
import {
  resolvePdfOptions,
  userTouchedPdfDefaults,
  buildPrintStyle,
  buildWindowsPrintFrameStyle,
  withPdfToc,
} from '../../lib/pdf-options';
import type { useSettingsStore } from '../../stores/settings';
import type { useToastsStore } from '../../stores/toasts';
import type { useI18n } from '../../i18n';
import type { ActiveDocument } from './export-shared.ts';

// Mermaid ids must be unique per render across the whole session — mermaid
// keys internal state off them and reusing one yields an empty diagram.
let printMermaidId = 0;

export interface PrintPdfDeps {
  activeOr: () => ActiveDocument | null;
  settings: ReturnType<typeof useSettingsStore>;
  toasts: ReturnType<typeof useToastsStore>;
  t: ReturnType<typeof useI18n>['t'];
}

export function createPrintPdfExporter({ activeOr, settings, toasts, t }: PrintPdfDeps) {
  /**
   * #301 — render ```mermaid fences inside the print overlay.
   *
   * `renderMarkdown()` leaves a mermaid fence as a plain
   * `<pre><code class="language-mermaid">` — the Preview pane and the image
   * PDF path (`markdownToPdfBlob`) each turn that into an SVG afterwards, but
   * the text PDF path never did, so "Export as PDF (text)" printed the diagram
   * source verbatim. Same treatment as those two, and it must finish BEFORE
   * the print dialog opens or the platform captures a half-rendered overlay.
   *
   * The `.mermaid-block` / `.mermaid-error` classes are the ones Preview's
   * global `:where(.preview-content) …` rules target, and the overlay content
   * div already carries `preview-content`, so the SVG is centered and
   * width-clamped on paper without any extra CSS.
   */
  async function renderPrintMermaid(container: HTMLElement, dark: boolean) {
    await renderGraphvizBlocks(container, { theme: dark ? 'dark' : 'default' });
    const blocks = container.querySelectorAll('pre > code.language-mermaid');
    if (!blocks.length) return;   // no diagrams: never load the renderer
    const mermaid = await initMermaid({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: dark ? 'dark' : 'default',
    });
    for (const block of Array.from(blocks)) {
      const pre = block.parentElement as HTMLElement | null;
      if (!pre) continue;
      const code = (block.textContent || '').trim();
      const id = `print-mmd-${++printMermaidId}`;
      try {
        const { svg } = await mermaid.render(id, code);
        const wrap = document.createElement('div');
        wrap.className = 'mermaid-block';
        wrap.innerHTML = svg;
        pre.replaceWith(wrap);
      } catch (e) {
        // A broken diagram must not abort the print — show the reason where
        // the diagram would have been, exactly like the Preview pane does.
        const err = document.createElement('pre');
        err.className = 'mermaid-error';
        err.textContent = `Mermaid error: ${(e as Error).message}`;
        pre.replaceWith(err);
      }
    }
  }

  /**
   * Open the system print dialog with the rendered markdown.
   * Builds a hidden iframe with the same HTML template used for export,
   * Print: mount a print-only overlay with the rendered markdown, then ask
   * Tauri (Rust side) to open the native print dialog. @media print CSS
   * hides the app shell so only our overlay prints cleanly.
   *
   * Why Rust? WKWebView's window.print() is silently no-op in Tauri 2 on
   * macOS. Tauri's Rust-side `WebviewWindow::print()` routes to the platform
   * native print (NSPrintOperation on macOS, WebView2 PrintAsync on Windows,
   * WebKitGTK print on Linux).
   */
  async function exportPdfPrint() {
    track('file_exported', { format: 'pdf_print' });
    const ctx = activeOr();
    if (!ctx) return;

    // Strip YAML front matter before rendering — users don't want the
    // metadata block to show up in the printed output.
    const pdfOpts = resolvePdfOptions(
      settings.pdfDefaults,
      ctx.content,
      userTouchedPdfDefaults(settings.pdfDefaults),
    );
    const stripped = ctx.content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
    // #347 — optional table-of-contents page (Settings → PDF, or `pdf: toc: true`).
    const source = pdfOpts.toc ? withPdfToc(stripped) : stripped;
    // v4.3.0 issue #77 — same link/image rewriting as the file-export path,
    // so the print overlay (and therefore the resulting PDF from the system
    // print dialog) doesn't show `http://tauri.localhost/...` links.
    const imageRoot = extractImageRoot(source);
    const body = rewriteLinkUrls(
      rewriteImageUrls(renderMarkdown(source), imageRoot, ctx.filePath),
      imageRoot,
      ctx.filePath,
    );

    // Print palette, independent of the app theme (see mountPrintOverlay).
    const printTheme = settings.printTheme || 'light';

    // v2.5 F3: inject @page / @media print stylesheet derived from
    // Settings → PDF defaults + per-doc `pdf:` front matter override.
    // When the user has never touched Settings AND the doc has no
    // `pdf:` block, `buildPrintStyle` returns "" and we mirror
    // pre-v2.5 webview-default behavior.
    // #347 — on Windows, move the page margins into the overlay so Chromium's
    // print headers/footers (date, title, URL) have nowhere to draw.
    const printCss = [
      buildPrintStyle(pdfOpts),
      isWindowsDesktop() ? buildWindowsPrintFrameStyle(pdfOpts) : '',
    ].filter(Boolean).join('\n');
    const { overlay: printOverlay, content: printContent, cleanup } = mountPrintOverlay(
      body,
      printTheme,
      printCss,
    );

    // #301 — swap mermaid fences for SVGs and WAIT for them. This has to
    // happen after the print-theme class is on the overlay (so the diagram
    // palette matches the paper) and before `print_webview`, because the
    // native print sheet snapshots the DOM as it finds it.
    if (printContent) {
      try {
        await renderPrintMermaid(
          printContent,
          printTheme === 'dark' || (printTheme === 'follow' && useThemeStore().mode === 'dark'),
        );
      } catch (e) {
        // Only reachable if the mermaid chunk itself fails to load (per-diagram
        // failures are handled inside). Printing the document with the fences
        // still as code beats refusing to print at all — and #115 says we must
        // never leave the overlay + `body.solomd-printing` mounted.
        console.error('[print] mermaid render failed', e);
      }
    }

    // Give KaTeX / images a tick to apply layout before print.
    await new Promise((r) => setTimeout(r, 200));

    // #347 — the TOC page gets a title, and page numbers when the page size is
    // known (Settings → PDF or `pdf:` front matter). Measured after mermaid
    // and the layout tick above, since both change where pages break.
    if (pdfOpts.toc && printContent) {
      try {
        const nav = decoratePrintToc(printContent, t('settings.pdfDefaults.tocTitle'));
        const box = printableBox(pdfOpts.pageSizeMm, pdfOpts.marginMm);
        if (nav && box) {
          withPrintPagination(printOverlay, printContent, box, (p) =>
            fillTocPageNumbers(nav, printContent, p.pageOf),
          );
        } else if (nav) {
          fillTocPageNumbers(nav, printContent, null);
        }
      } catch (e) {
        // Numbers are a nicety; a failure here must never stop the print.
        console.error('[print] toc page numbers failed', e);
      }
    }
    try {
      await convertPort.printWebview();
      // The native print sheet is modal; by the time the port call resolves,
      // the user has already dismissed it. Safe to tear down shortly after.
      setTimeout(cleanup, 100);
    } catch (e) {
      console.error('[print] failed', e);
      // #115 — tear down the print DOM (the full-screen #solomd-print-overlay
      // + `body.solomd-printing`) SYNCHRONOUSLY on error. The old code only
      // scheduled cleanup via setTimeout in `finally`; if the print invoke
      // rejected, the editor was left under the print-mode body state and
      // felt unresponsive ("mouse input dead after an export error" on macOS).
      cleanup();
      toasts.error(`Print failed: ${e}`);
    }
  }

  return exportPdfPrint;
}
