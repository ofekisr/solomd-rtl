/**
 * Dev harness for the PDF export's pagination — open `/src/dev/pdf-harness.html` from
 * the Vite dev server (`pnpm --dir app dev`, or `npm --prefix app run dev`).
 *
 * It renders a long, adversarial markdown document through the *real* export
 * pipeline (`capturePdfRaster`), then answers the only question that matters:
 * does a page boundary ever land on a row with ink in it? A boundary with ink
 * on both sides is a sheared line of text — the "PDF export clipped across pages" bug.
 *
 * It reports jsPDF's own cut lines (the old behaviour) next to the ones the
 * export now chooses, and draws a strip of each page break so the difference
 * is visible, not just asserted.
 */
import { capturePdfRaster, buildHtml2PdfOptions } from '../lib/pdf/export';
import { buildPagedCanvas } from '../lib/pdf/paginate';
import {
  isSheared, blankRun, rowsTouchingRightEdge, strip, table, px, countPdfPages,
  type BoundaryCheck,
} from './pdf-harness-measure.ts';
import { PDF_OPTS, fixture, CONFIGS, type HarnessConfig } from './pdf-harness-fixture.ts';

const statusEl = document.getElementById('status') as HTMLElement;
const reportEl = document.getElementById('report') as HTMLElement;
const evidenceEl = document.getElementById('evidence') as HTMLElement;

export interface HarnessReport {
  status: 'ok' | 'failed';
  label: string;
  pageHeightPx: number;
  searchUpPx: number;
  raster: { width: number; height: number; rightEdgeRows: number };
  jsPdfBoundaries: BoundaryCheck[];
  exportBoundaries: BoundaryCheck[];
  pdf: { pages: number; expectedPages: number; bytes: number; gridAligned: boolean };
  error?: string;
}

/** Free a canvas' backing store as soon as the numbers are in. */
function release(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

async function run(
  config: HarnessConfig,
  withEvidence: boolean,
  markdown?: string,
): Promise<HarnessReport> {
  const capture = await capturePdfRaster(markdown ?? fixture(config.blocks), 'harness', config.opts);
  try {
    const raw = capture.canvas;
    if (!raw) throw new Error('html2pdf did not hand back a raster');
    const { pageHeightPx, searchUpPx, lineHeightPx } = capture;
    const pageCount = Math.ceil(raw.height / pageHeightPx);

    // What the export used to produce: jsPDF slicing this very raster at a
    // fixed page height. Measured on the raw raster, so the "before" numbers
    // are exactly what the old code would have handed the user.
    const jsPdfBoundaries: BoundaryCheck[] = [];
    for (let page = 1; page < pageCount; page++) {
      const nominal = Math.floor(page * pageHeightPx);
      jsPdfBoundaries.push({
        nominal,
        cut: nominal,
        moved: 0,
        sheared: isSheared(raw, nominal),
        blankAbove: blankRun(raw, nominal - 1, -1),
        blankBelow: blankRun(raw, nominal, 1),
      });
    }

    // What it produces now.
    const paged = buildPagedCanvas(raw, pageHeightPx, searchUpPx, lineHeightPx);
    if (!paged) throw new Error('buildPagedCanvas produced nothing');
    const exportBoundaries: BoundaryCheck[] = paged.breaks.map((cut, i) => {
      const boundary = (i + 1) * pageHeightPx;
      return {
        nominal: jsPdfBoundaries[i]?.nominal ?? boundary,
        cut,
        moved: boundary - cut,
        sheared: isSheared(paged.canvas, boundary),
        blankAbove: blankRun(paged.canvas, boundary - 1, -1),
        blankBelow: blankRun(paged.canvas, boundary, 1),
      };
    });

    // Evidence strips need both rasters, so draw them before anything is freed.
    evidenceEl.replaceChildren();
    if (withEvidence) {
      exportBoundaries.forEach((check, i) => {
        const boundary = (i + 1) * pageHeightPx;
        evidenceEl.append(
          strip(
            raw,
            check.nominal,
            check.nominal,
            `BEFORE · jsPDF's own cut at ${px(check.nominal)}${check.sheared ? ' — SHEARED' : ''}`,
          ),
          strip(
            paged.canvas,
            boundary,
            boundary,
            `AFTER · cut at ${px(check.cut)}, gave up ${check.moved}px`,
          ),
        );
      });
    }

    const rightEdgeRows = rowsTouchingRightEdge(raw);
    const rasterSize = { width: raw.width, height: raw.height };
    capture.useCanvas(paged.canvas);
    const blob = await capture.finish();
    const pages = await countPdfPages(blob);
    const expectedPages = paged.breaks.length + 1;
    const gridAligned = pages === expectedPages;
    const shearedBefore = jsPdfBoundaries.filter((c) => c.sheared).length;
    const shearedAfter = exportBoundaries.filter((c) => c.sheared).length;
    release(raw);
    release(paged.canvas);

    const report: HarnessReport = {
      status: shearedAfter || !gridAligned ? 'failed' : 'ok',
      label: config.label,
      pageHeightPx,
      searchUpPx,
      raster: { ...rasterSize, rightEdgeRows },
      jsPdfBoundaries,
      exportBoundaries,
      pdf: { pages, expectedPages, bytes: blob.size, gridAligned },
    };

    if (withEvidence) {
      reportEl.innerHTML = `
        <div>${config.label} · page height ${pageHeightPx}px · search window ${searchUpPx}px ·
          ${pageCount} raster pages · ${rightEdgeRows} rows run into the right edge</div>
        <h2>jsPDF's own cut lines (the old export)</h2>
        ${table(jsPdfBoundaries)}
        <div><strong>${shearedBefore}</strong> of ${jsPdfBoundaries.length} boundaries sheared a line of text</div>
        <h2>Cuts chosen by the export now</h2>
        ${table(exportBoundaries)}
        <div><strong>${shearedAfter}</strong> of ${exportBoundaries.length} boundaries sheared a line of text</div>
        <div>PDF: ${pages} pages (the grid predicted ${expectedPages}) ·
          ${(blob.size / 1024).toFixed(0)} KB ·
          ${gridAligned ? 'jsPDF sliced exactly our pages' : 'GRID MISALIGNED — the raster is not page-sized'}</div>
      `;
      statusEl.textContent =
        report.status === 'ok'
          ? `PASS — ${config.label}: ${exportBoundaries.length} page breaks, none on ink (${shearedBefore} used to be sheared)`
          : `FAIL — ${config.label}: ${shearedAfter} page breaks on ink, grid aligned: ${gridAligned}`;
      statusEl.style.borderLeftColor = report.status === 'ok' ? '#1a7f37' : '#c02b2b';
    }
    return report;
  } finally {
    capture.dispose();
  }
}

/** Every page setup, for comparing where the old slicing actually cut a line. */
async function scan(): Promise<HarnessReport[]> {
  const out: HarnessReport[] = [];
  for (const config of CONFIGS) out.push(await run(config, false));
  return out;
}

/**
 * The same measurement for a document of your own — a browser page can't read
 * a note off disk, so the caller hands the markdown over (with any local images
 * already inlined as `data:` URLs, which is what the app's own export does).
 */
async function runDocument(markdown: string, label: string): Promise<HarnessReport> {
  return await run({ ...CONFIGS[0], label }, true, markdown);
}

declare global {
  interface Window {
    __pdfHarness?: HarnessReport | { status: 'failed'; error: string };
    __pdfHarnessRun?: (
      config: HarnessConfig,
      withEvidence: boolean,
      markdown?: string,
    ) => Promise<HarnessReport>;
    __pdfHarnessScan?: () => Promise<HarnessReport[]>;
    __pdfHarnessDocument?: (markdown: string, label: string) => Promise<HarnessReport>;
    /** The html2pdf options the export builds, for inspection. */
    __pdfHarnessOptions?: () => unknown;
  }
}

window.__pdfHarnessRun = run;
window.__pdfHarnessScan = scan;
window.__pdfHarnessDocument = runDocument;
window.__pdfHarnessOptions = () => buildHtml2PdfOptions('probe', PDF_OPTS);

run(CONFIGS[0], true).then(
  (report) => {
    window.__pdfHarness = report;
  },
  (error: unknown) => {
    statusEl.textContent = `FAIL — ${String(error)}`;
    statusEl.style.borderLeftColor = '#c02b2b';
    window.__pdfHarness = { status: 'failed', error: String(error) };
  },
);
