import { z } from 'zod';
import type { SettingsSlice } from '../../contracts/index.ts';

/** v2.5 PDF / print export defaults. */
export interface PdfDefaults {
  /** Page size preset (`A4` / `A5` / `Letter` / `Legal`) or `Custom`. */
  pageSize: 'A4' | 'A5' | 'Letter' | 'Legal' | 'Custom';
  /** Custom page width in mm — only consulted when `pageSize === 'Custom'`. */
  customWidthMm: number;
  /** Custom page height in mm — only consulted when `pageSize === 'Custom'`. */
  customHeightMm: number;
  /** Margin preset (`Narrow` 10mm / `Normal` 15mm / `Wide` 25mm / `Custom`). */
  margin: 'Narrow' | 'Normal' | 'Wide' | 'Custom';
  /** Custom margins in mm — only consulted when `margin === 'Custom'`. */
  customMarginTopMm: number;
  customMarginRightMm: number;
  customMarginBottomMm: number;
  customMarginLeftMm: number;
  /** Font family for body text. Empty string = let the PDF stylesheet decide. */
  fontFamily: string;
  /** Font size in pt (9-16). */
  fontSize: number;
  /** When true, append a page-number footer. */
  footer: boolean;
  /** Code-block syntax highlighting in PDF: match preview / always light / always dark. */
  codeTheme: 'preview' | 'light' | 'dark';
  /** #347 — start the text PDF with a table-of-contents page. */
  toc: boolean;
}

export function defaultPdfDefaults(): PdfDefaults {
  return {
    pageSize: 'A4',
    customWidthMm: 210,
    customHeightMm: 297,
    margin: 'Normal',
    customMarginTopMm: 15,
    customMarginRightMm: 15,
    customMarginBottomMm: 15,
    customMarginLeftMm: 15,
    fontFamily: '',
    fontSize: 11,
    footer: true,
    codeTheme: 'preview',
    toc: false,
  };
}

/**
 * Merge a (possibly partial / legacy) saved `pdfDefaults` blob with the
 * current schema defaults. Treats unknown / out-of-range numeric values
 * as "use the default" so a 5MB margin can never sneak in via tampered
 * localStorage.
 */
export function mergePdfDefaults(saved: unknown): PdfDefaults {
  const base = defaultPdfDefaults();
  if (!saved || typeof saved !== 'object') return base;
  const s = saved as Partial<PdfDefaults>;
  const clamp = (n: unknown, min: number, max: number, fallback: number) => {
    const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
    return Math.max(min, Math.min(max, v));
  };
  const okPageSize = ['A4', 'A5', 'Letter', 'Legal', 'Custom'] as const;
  const okMargin = ['Narrow', 'Normal', 'Wide', 'Custom'] as const;
  const okCodeTheme = ['preview', 'light', 'dark'] as const;
  return {
    pageSize: okPageSize.includes(s.pageSize as never) ? (s.pageSize as PdfDefaults['pageSize']) : base.pageSize,
    customWidthMm: clamp(s.customWidthMm, 50, 500, base.customWidthMm),
    customHeightMm: clamp(s.customHeightMm, 50, 500, base.customHeightMm),
    margin: okMargin.includes(s.margin as never) ? (s.margin as PdfDefaults['margin']) : base.margin,
    customMarginTopMm: clamp(s.customMarginTopMm, 5, 100, base.customMarginTopMm),
    customMarginRightMm: clamp(s.customMarginRightMm, 5, 100, base.customMarginRightMm),
    customMarginBottomMm: clamp(s.customMarginBottomMm, 5, 100, base.customMarginBottomMm),
    customMarginLeftMm: clamp(s.customMarginLeftMm, 5, 100, base.customMarginLeftMm),
    fontFamily: typeof s.fontFamily === 'string' ? s.fontFamily : base.fontFamily,
    fontSize: clamp(s.fontSize, 9, 16, base.fontSize),
    footer: typeof s.footer === 'boolean' ? s.footer : base.footer,
    codeTheme: okCodeTheme.includes(s.codeTheme as never) ? (s.codeTheme as PdfDefaults['codeTheme']) : base.codeTheme,
    toc: typeof s.toc === 'boolean' ? s.toc : base.toc,
  };
}

export type ExportSettings = {
  // v2.5 F3: PDF / print export defaults. When a field is the empty string
  // / `null` we fall back to whatever the webview / jsPDF chose (i.e. the
  // pre-v2.5 behavior). YAML front matter `pdf:` block on a doc overrides
  // these per-document.
  pdfDefaults: PdfDefaults;
  // v3.6: PNG export — show "Created with SoloMD · solomd.app" footer
  // under the rendered note. Default ON (mild self-promotion is fine
  // for a free MIT app), but explicitly toggleable in Settings → Export
  // for users who don't want the watermark on screenshots they share.
  imageExportBranding: boolean;
  // DOCX export template: which of the built-in presets (plain / report /
  // academic) a Word export starts from. A per-document `docx:` front-matter
  // block overrides individual keys, the same way `pdf:` does.
  docxPreset: 'plain' | 'report' | 'academic';
  // Print / system-PDF palette, independent of the app theme. Printing in a
  // dark theme put a dark slab on paper and wasted ink; `light` (the default)
  // always prints on white, `dark` prints the dark palette on purpose, and
  // `follow` keeps whatever theme the app is in.
  printTheme: 'light' | 'dark' | 'follow';
};

const schema = z.object({
  pdfDefaults: z.custom<PdfDefaults>(),
  imageExportBranding: z.boolean(),
  docxPreset: z.enum(['plain', 'report', 'academic']),
  printTheme: z.enum(['light', 'dark', 'follow']),
});

function defaults(): ExportSettings {
  return {
    pdfDefaults: defaultPdfDefaults(),
    imageExportBranding: true,
    docxPreset: 'plain',
    printTheme: 'light',
  };
}

export const exportSlice: SettingsSlice<ExportSettings> = {
  id: 'export',
  schema,
  defaults,
  normalize(parsed, merged) {
    merged.pdfDefaults = mergePdfDefaults(parsed.pdfDefaults);
  },
};
