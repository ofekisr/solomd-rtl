/**
 * Direct PDF export for SoloMD using html2pdf.js (jsPDF + html2canvas).
 *
 * Strategy: render the markdown into an off-screen DOM container with the
 * same look as the Preview pane, run any Mermaid blocks through the
 * mermaid renderer to inject SVGs, then capture the container with
 * html2canvas and emit a multi-page PDF.
 *
 * Quality is raster (high-DPI) which means: text is not searchable but
 * Chinese / KaTeX / Mermaid all "just work" because we capture whatever
 * the browser actually renders.
 */

// @ts-ignore — html2pdf.js ships no types
import { renderGraphvizBlocks } from '../graphviz';
import { initMermaid } from '../mermaid-lazy';
import { renderMarkdown, extractImageRoot } from '../markdown/markdown';
import type { ResolvedPdfOptions } from './options';
import { PDF_CSS } from './css.ts';
import { sanitizeModernColors } from './colors.ts';
import { buildHtml2PdfOptions } from './html2pdf-options.ts';
import { quoteFontFamily } from './font.ts';
import { rewriteImageUrls, rewriteLinkUrls } from '../image/resolve';
import { buildPagedCanvas, searchWindowPx } from './paginate';

export { buildHtml2PdfOptions };

const EXPORT_TIMEOUT_MS = 30_000;


let mermaidId = 0;

async function processMermaidBlocks(container: HTMLElement) {
  await renderGraphvizBlocks(container);
  const blocks = container.querySelectorAll('pre > code.language-mermaid');
  if (!blocks.length) return;   // no diagrams: never pay for the renderer
  const mermaid = await initMermaid({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'default',
  });
  for (const block of Array.from(blocks)) {
    const pre = block.parentElement as HTMLElement | null;
    if (!pre) continue;
    const code = (block.textContent || '').trim();
    const id = `pdf-mmd-${++mermaidId}`;
    try {
      const { svg } = await mermaid.render(id, code);
      const wrap = document.createElement('div');
      wrap.className = 'mermaid-block';
      wrap.innerHTML = svg;
      pre.replaceWith(wrap);
    } catch (e) {
      const err = document.createElement('pre');
      err.textContent = `Mermaid error: ${(e as Error).message}`;
      pre.replaceWith(err);
    }
  }
}

/**
 * #115 — html2pdf.js renders into a full-screen `div.html2pdf__overlay`
 * (position:fixed; z-index:1000; visible) and html2canvas clones into an
 * `iframe.html2canvas-container`. On a thrown or hung export these are left
 * mounted: the overlay swallows EVERY mouse click (the UI feels frozen, Cmd-Q
 * only) and the orphan iframe surfaces as a zoomable "nested page" that
 * survives a restart. Sweep them so no export, success or failure, can wedge
 * the app.
 */
function sweepExportLeftovers(): void {
  document
    .querySelectorAll('.html2pdf__overlay, iframe.html2canvas-container')
    .forEach((n) => n.remove());
}


export interface PdfRasterCapture {
  /** The raster html2pdf captured, still unsliced. */
  canvas: HTMLCanvasElement | null;
  /**
   * Height of one page in raster pixels — jsPDF's own slice height, derived
   * the same way `toPdf()` derives it so a re-paginated raster lines up with
   * the slicer exactly. `0` when html2pdf's internals are not reachable, which
   * switches pagination off and leaves the old behaviour in place.
   */
  pageHeightPx: number;
  /** How far above a boundary a page cut may look, in raster pixels. */
  searchUpPx: number;
  /** One body line in raster pixels (drives the between-table-rows cut). */
  lineHeightPx: number;
  /** Hand back a re-paginated raster for `finish()` to slice. */
  useCanvas(canvas: HTMLCanvasElement): void;
  /** Slice the raster into pages and assemble the PDF. */
  finish(): Promise<Blob>;
  /** Drop the off-screen page and sweep any html2pdf leftovers (#115). */
  dispose(): void;
}

/**
 * The parts of html2pdf's worker we reach into to re-paginate its raster. Not
 * in the published types and not part of its API — hence the cast — but it is
 * the only way to keep jsPDF's slicing from shearing a line of text (see
 * `pdf-paginate.ts`). Every use is optional-chained: if a future version
 * reshapes `prop`, `markdownToPdfBlob` simply behaves as it did before.
 */
interface Html2PdfWorkerInternals {
  prop?: {
    canvas?: HTMLCanvasElement;
    pageSize?: { inner?: { width: number; height: number } };
  };
}

/** CSS pixels per millimetre at the 96dpi the layout engine uses. */
const CSS_PX_PER_MM = 96 / 25.4;

/** Fallback body line height (px) when the computed style can't be read. */
const FALLBACK_LINE_HEIGHT_PX = 26;

/**
 * Render `source` into an off-screen page and rasterise it, without slicing it
 * into pages yet.
 *
 * The raster is handed back so it can be re-paginated (see `pdf-paginate.ts`)
 * before `finish()` lets jsPDF slice it. Exported for the pagination harness
 * (`app/pdf-harness.html`), which measures exactly what the export measures.
 */
export async function capturePdfRaster(
  source: string,
  title: string,
  pdfOpts?: ResolvedPdfOptions,
  filePath?: string,
): Promise<PdfRasterCapture> {
  const rawHtml = renderMarkdown(source || '');
  // v4.3.0 issue #77 — also rewrite link hrefs so local-file links
  // don't bake in `http://tauri.localhost/...` URLs.
  const imageRoot = extractImageRoot(source || '');
  const html = rewriteLinkUrls(
    rewriteImageUrls(rawHtml, imageRoot, filePath),
    imageRoot,
    filePath,
  );

  // Build an off-screen container that mimics the preview look.
  const styleEl = document.createElement('style');
  styleEl.textContent = PDF_CSS;

  // v2.5 F3: derived font / size CSS overlay (only when caller passed
  // options that the user actually customized). Empty string when the user
  // hasn't touched Settings *and* the doc has no `pdf:` block.
  let extraStyle: HTMLStyleElement | null = null;
  if (pdfOpts && pdfOpts.pageSizeMm && pdfOpts.marginMm) {
    extraStyle = document.createElement('style');
    const fontDecl = pdfOpts.fontFamily.trim()
      ? `font-family: ${quoteFontFamily(pdfOpts.fontFamily)}, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif !important;`
      : '';
    const codeOverride =
      pdfOpts.codeTheme === 'light'
        ? `.pdf-page pre, .pdf-page code { background: #f6f8fa !important; color: #1f2328 !important; }`
        : pdfOpts.codeTheme === 'dark'
        ? `.pdf-page pre, .pdf-page code { background: #1f2328 !important; color: #eee !important; }`
        : '';
    extraStyle.textContent = `
      .pdf-page {
        ${fontDecl}
        font-size: ${pdfOpts.fontSizePt}pt !important;
      }
      ${codeOverride}
    `;
  }

  const root = document.createElement('div');
  root.style.position = 'fixed';
  root.style.left = '-10000px';
  root.style.top = '0';
  root.style.zIndex = '-1';

  const page = document.createElement('article');
  page.className = 'pdf-page';
  page.innerHTML = html;

  root.appendChild(styleEl);
  if (extraStyle) root.appendChild(extraStyle);
  root.appendChild(page);
  document.body.appendChild(root);

  let cleaned = false;
  const dispose = () => {
    if (cleaned) return;
    cleaned = true;
    root.remove();
    sweepExportLeftovers();
  };
  try {
    // Render any Mermaid blocks before capture.
    await processMermaidBlocks(page);
    // Give the browser a tick to lay everything out (KaTeX fonts especially).
    await new Promise((r) => setTimeout(r, 60));
    // #115 — convert any modern CSS color functions (color()/oklch()/…) that
    // html2canvas can't parse into resolved sRGB rgba(), now that Mermaid SVGs
    // and KaTeX are in the tree. Runs on the live (offscreen) node so
    // getComputedStyle sees the cascade.
    sanitizeModernColors(page);

    const opts = buildHtml2PdfOptions(title, pdfOpts);
    // html2pdf drags in jsPDF + html2canvas (~1 MB). Load it when an
    // export actually happens, not on every cold start.
    const html2pdf = (await import('html2pdf.js')).default;
    const worker = html2pdf().set(opts).from(page);
    // Capture here rather than letting `outputPdf()` do it, so the raster can
    // be re-paginated first.
    await worker.toCanvas();
    const prop = (worker as unknown as Html2PdfWorkerInternals).prop;
    const canvas = prop?.canvas ?? null;
    const inner = prop?.pageSize?.inner;
    const geometry = pdfPaginationGeometry(canvas, inner, page);

    return {
      canvas,
      pageHeightPx: geometry.pageHeightPx,
      searchUpPx: geometry.searchUpPx,
      lineHeightPx: geometry.lineHeightPx,
      useCanvas(replacement: HTMLCanvasElement) {
        if (prop) prop.canvas = replacement;
      },
      async finish(): Promise<Blob> {
        return await worker.outputPdf('blob');
      },
      dispose,
    };
  } catch (e) {
    dispose();
    throw e;
  }
}

/**
 * jsPDF slice height + how far a cut may climb, both in raster pixels.
 *
 * `pageHeightPx` repeats html2pdf's own arithmetic (`toPdf()` does
 * `Math.floor(canvas.width * pageSize.inner.ratio)`), because the re-paginated
 * raster is only safe if the slicer's grid and ours are the same grid.
 */
function pdfPaginationGeometry(
  canvas: HTMLCanvasElement | null,
  inner: { width: number; height: number } | undefined,
  page: HTMLElement,
): { pageHeightPx: number; searchUpPx: number; lineHeightPx: number } {
  if (!canvas || !inner || !(inner.width > 0) || !(inner.height > 0)) {
    return { pageHeightPx: 0, searchUpPx: 0, lineHeightPx: 0 };
  }
  const pageHeightPx = Math.floor(canvas.width * (inner.height / inner.width));
  // html2pdf's container is exactly the printable width, declared in mm, so
  // this converts raster pixels back to CSS pixels for the line-height cap.
  const rasterPerCssPx = canvas.width / (inner.width * CSS_PX_PER_MM);
  const measured = parseFloat(getComputedStyle(page).lineHeight);
  const lineHeightPx = Number.isFinite(measured) ? measured : FALLBACK_LINE_HEIGHT_PX;
  return {
    pageHeightPx,
    searchUpPx: searchWindowPx(lineHeightPx, rasterPerCssPx, pageHeightPx),
    lineHeightPx: Math.round(lineHeightPx * rasterPerCssPx),
  };
}

/**
 * @param source — markdown source (may include YAML front matter; rendering
 *   strips the block so it doesn't bleed into the PDF body).
 * @param title — used for the `filename` field on the html2pdf builder.
 * @param pdfOpts — v2.5 resolved options (Settings + frontmatter merged).
 *   Pass `undefined` to preserve pre-v2.5 hardcoded A4 / 10mm behavior.
 * @param filePath — used to resolve relative image paths in the markdown.
 */
export async function markdownToPdfBlob(
  source: string,
  title: string,
  pdfOpts?: ResolvedPdfOptions,
  filePath?: string,
): Promise<Blob> {
  // Timeout guard — prevents the export from hanging the UI indefinitely
  // if html2pdf.js or Mermaid gets stuck. It sweeps html2pdf's leftovers on
  // the way out: a hung capture can leave its invisible full-screen overlay
  // mounted, which swallows every click in the app.
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => {
      sweepExportLeftovers();
      reject(new Error('PDF export timed out'));
    }, EXPORT_TIMEOUT_MS),
  );

  const render = async (): Promise<Blob> => {
    const capture = await capturePdfRaster(source, title, pdfOpts, filePath);
    try {
      // jsPDF slices the raster at a fixed page height, which shears whatever
      // line of text sits on the boundary. Re-lay the raster as whole pages
      // first, so every slice lands on a row with no ink in it.
      const paged = capture.canvas
        ? buildPagedCanvas(
            capture.canvas,
            capture.pageHeightPx,
            capture.searchUpPx,
            capture.lineHeightPx,
          )
        : null;
      if (paged) capture.useCanvas(paged.canvas);
      return await capture.finish();
    } finally {
      capture.dispose();
    }
  };

  return await Promise.race([render(), timeout]);
}
