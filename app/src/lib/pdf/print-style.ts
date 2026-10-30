import type { ResolvedPdfOptions } from './options.ts';
import { quoteFontFamily } from './font.ts';

/**
 * Build a `<style>` string suitable for injection before
 * `window.print()` / `WebviewWindow::print()`. When `opts.pageSizeMm` is
 * `null` we emit nothing (preserve pre-v2.5 webview defaults).
 */
export function buildPrintStyle(opts: ResolvedPdfOptions): string {
  if (!opts.pageSizeMm || !opts.marginMm) return '';
  const { pageSizeMm, marginMm, fontFamily, fontSizePt, footer, codeTheme } = opts;
  const margin = `${marginMm.top}mm ${marginMm.right}mm ${marginMm.bottom}mm ${marginMm.left}mm`;
  const size = `${pageSizeMm.width}mm ${pageSizeMm.height}mm`;
  // Quote font family if it contains whitespace and isn't already quoted.
  const fontDecl = fontFamily.trim()
    ? `body, .preview-content, .solomd-print-content { font-family: ${quoteFontFamily(fontFamily)}, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif !important; }`
    : '';
  const fontSizeDecl = `body, .preview-content, .solomd-print-content { font-size: ${fontSizePt}pt !important; }`;
  const codeThemeDecl = codeTheme === 'light'
    ? `pre, code { background: #f6f8fa !important; color: #1f2328 !important; }`
    : codeTheme === 'dark'
    ? `pre, code { background: #1f1d1a !important; color: #eee !important; }`
    : '';
  // Page-number footer via CSS counters. Browsers (Chrome / WebKit) honor
  // @page margin boxes; older WebViews may ignore them silently which is
  // acceptable degradation.
  const footerRule = footer
    ? `@page { @bottom-center { content: counter(page) " / " counter(pages); font-size: 9pt; color: #888; } }`
    : '';
  return `
@page { size: ${size}; margin: ${margin}; }
${footerRule}
@media print {
  ${fontDecl}
  ${fontSizeDecl}
  ${codeThemeDecl}
}
`.trim();
}

/**
 * #347 — the date / title / URL / page-number lines on a text PDF printed on
 * Windows. Those are Chromium's print headers and footers: WebView2's
 * `window.print()` opens Chromium's print preview with "Headers and footers"
 * ticked, and it draws them inside the page margin. Chromium drops them when
 * the page has no margin to draw in, so on Windows the page margin becomes 0
 * and the same margins are put back as padding on the print overlay,
 * repeated on every page by `box-decoration-break: clone` (Chromium supports
 * it across page breaks). WebKit (macOS / Linux) does not print headers
 * unless asked and does not clone padding across pages, so this is
 * Windows-only.
 *
 * Trade-off: the optional page-number footer (`@page @bottom-center`) needs a
 * bottom margin, so on Windows it is not drawn.
 */
export function buildWindowsPrintFrameStyle(opts: ResolvedPdfOptions): string {
  const m = opts.marginMm ?? { top: 12, right: 12, bottom: 12, left: 12 };
  return `
@page { margin: 0 !important; @bottom-center { content: none; } }
@media print {
  body.solomd-printing #solomd-print-overlay {
    padding: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm !important;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  }
}
`.trim();
}

const TOC_LINE_RE = /^[ \t]*\[toc\][ \t]*$/im;

/**
 * #347 — the source the text PDF renders when a table of contents was asked
 * for: a `[TOC]` marker (rendered by markdown.ts as `<nav class="md-toc">`)
 * at the top, unless the note already places one itself. The print
 * stylesheet starts the body on a new page after a leading TOC.
 * Expects the front matter to be stripped already, as `exportPdfPrint` does.
 */
export function withPdfToc(source: string): string {
  if (TOC_LINE_RE.test(source)) return source;
  return `[TOC]\n\n${source}`;
}

