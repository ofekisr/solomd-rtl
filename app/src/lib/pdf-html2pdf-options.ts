import type { ResolvedPdfOptions } from './pdf-options.ts';

export interface Html2PdfOptions {
  margin: [number, number, number, number];
  filename: string;
  image: { type: 'jpeg'; quality: number };
  html2canvas: {
    scale: number;
    useCORS: boolean;
    backgroundColor: string;
    letterRendering: boolean;
    logging: boolean;
  };
  jsPDF: {
    unit: 'mm';
    format: string | [number, number];
    orientation: 'portrait' | 'landscape';
  };
  pagebreak: { mode: string[]; avoid: string[] };
}

/** The html2pdf option object, shared by the export and the test harness. */
export function buildHtml2PdfOptions(title: string, pdfOpts?: ResolvedPdfOptions): Html2PdfOptions {
  // v2.5 F3: derive jsPDF / margin args from the resolved opts. When
  // the caller didn't customize anything, fall back to the legacy
  // hardcoded values so old users see exactly the same output as v2.4.
  let margins: [number, number, number, number] = [10, 10, 12, 10];
  let jsPdfFormat: string | [number, number] = 'a4';
  let orientation: 'portrait' | 'landscape' = 'portrait';
  if (pdfOpts && pdfOpts.pageSizeMm && pdfOpts.marginMm) {
    margins = [
      pdfOpts.marginMm.top,
      pdfOpts.marginMm.right,
      pdfOpts.marginMm.bottom,
      pdfOpts.marginMm.left,
    ];
    const named = pageSizeLabelToJsPdf(pdfOpts.pageSizeLabel);
    if (named) {
      jsPdfFormat = named;
    } else {
      jsPdfFormat = [pdfOpts.pageSizeMm.width, pdfOpts.pageSizeMm.height];
    }
    orientation =
      pdfOpts.pageSizeMm.width > pdfOpts.pageSizeMm.height ? 'landscape' : 'portrait';
  }

  return {
    margin: margins,
    filename: `${title || 'document'}.pdf`,
    image: { type: 'jpeg', quality: 0.96 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      letterRendering: true,
      logging: false,
    },
    jsPDF: {
      unit: 'mm',
      format: jsPdfFormat,
      orientation,
    },
    pagebreak: {
      mode: ['css', 'legacy'],
      // html2canvas rasterises the whole document and jsPDF slices it by
      // page height, so a page break can shear a line of body text in
      // half. `avoid` makes html2pdf's element-level pass push these whole
      // elements onto the next page instead. Body paragraphs (`p`), list
      // items (`li`) and images (`img`) were missing — that left running
      // text getting cut across the page boundary. (We deliberately keep
      // `ul`/`ol` OUT: avoiding those would treat a whole multi-page list
      // as one unsplittable block; we break between `li`s instead.)
      //
      // This pass works in CSS pixels while jsPDF slices raster pixels, so it
      // can only ever be a hint — see `pdf-paginate.ts` for the pass that
      // actually guarantees no glyph is cut.
      avoid: [
        'pre', '.mermaid-block', 'table', 'blockquote',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'li', 'img',
      ],
    },
  };
}

function pageSizeLabelToJsPdf(label: string): string | null {
  switch (label) {
    case 'A4':
      return 'a4';
    case 'A5':
      return 'a5';
    case 'Letter':
      return 'letter';
    case 'Legal':
      return 'legal';
    default:
      return null;
  }
}
