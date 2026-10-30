/**
 * v2.5 F3 — resolve effective PDF / print export options from
 * Settings → PDF defaults plus optional per-document YAML front matter.
 *
 * Per-document override is opt-in via a `pdf:` block, e.g.
 *
 * ```yaml
 * ---
 * pdf:
 *   pageSize: A4
 *   margin: 15mm
 *   font: 'PingFang SC'
 *   fontSize: 11
 *   footer: true
 * ---
 * ```
 *
 * When a `pdf:` block is present, individual keys win over Settings; keys
 * the user *didn't* set still come from Settings. When the user has not
 * touched Settings either, we return a "blank" preset that callers can
 * detect (`isBlankPreset`) and fall back to webview / jsPDF defaults —
 * preserving the pre-v2.5 behavior so we don't break anything for users
 * who never opened the new section.
 */
import type { PdfDefaults } from '../stores/settings';
import { defaultPdfDefaults } from '../stores/settings';
import { parsePdfFrontMatter, parseMmNumber } from './pdf-frontmatter.ts';

export { parsePdfFrontMatter } from './pdf-frontmatter.ts';
export {
  buildPrintStyle,
  buildWindowsPrintFrameStyle,
  withPdfToc,
} from './pdf-print-style.ts';

export interface ResolvedPdfOptions {
  /**
   * Effective page size in mm. `null` means "use the renderer's default" —
   * happens when the user has never touched Settings AND the doc has no
   * `pdf:` block. Callers should fall back to the engine's native default.
   */
  pageSizeMm: { width: number; height: number } | null;
  /** Human-readable preset label (`A4`, `Letter`, `Custom`, …) for telemetry / footer text. */
  pageSizeLabel: string;
  /** Effective margins in mm (top / right / bottom / left). */
  marginMm: { top: number; right: number; bottom: number; left: number } | null;
  /** Effective body font family. Empty string = let the stylesheet decide. */
  fontFamily: string;
  /** Effective body font size in pt. */
  fontSizePt: number;
  /** Whether to render the page-number footer. */
  footer: boolean;
  /** Code-block syntax theme override. */
  codeTheme: 'preview' | 'light' | 'dark';
  /** #347 — open the text PDF with a generated table-of-contents page. */
  toc: boolean;
}

const PAGE_SIZES_MM: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
};

const MARGIN_PRESETS_MM: Record<string, number> = {
  Narrow: 10,
  Normal: 15,
  Wide: 25,
};

/** Clamp a numeric mm value into [min, max]. NaN becomes `fallback`. */
function clampMm(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.max(min, Math.min(max, v));
}


/**
 * Resolve effective PDF options from settings + frontmatter.
 *
 * `userTouchedDefaults` lets the caller distinguish "user explicitly opted
 * into v2.5 PDF defaults" (in which case we return concrete numbers) from
 * "user has never touched Settings" (return `null` so the renderer falls
 * back to its native defaults — pre-v2.5 behavior).
 */
export function resolvePdfOptions(
  settingsDefaults: PdfDefaults,
  source: string,
  userTouchedDefaults = true,
): ResolvedPdfOptions {
  const fm = parsePdfFrontMatter(source);
  // The TOC switch is independent of page setup: turning it on must not also
  // move a user off the webview's default paper and margins.
  const toc = typeof fm.toc === 'boolean' ? fm.toc : settingsDefaults.toc === true;
  const fmHasAny = Object.keys(fm).some((k) => k !== 'toc');
  const apply = userTouchedDefaults || fmHasAny;

  if (!apply) {
    // Pre-v2.5 path: user never touched the section AND the doc has no
    // pdf: block — return null sentinels so callers know to use engine
    // defaults verbatim.
    return {
      pageSizeMm: null,
      pageSizeLabel: 'Default',
      marginMm: null,
      fontFamily: '',
      fontSizePt: 11,
      footer: false,
      codeTheme: 'preview',
      toc,
    };
  }

  // ---- Page size --------------------------------------------------------
  let pageSizeMm: { width: number; height: number };
  let pageSizeLabel: string;
  if (fm.pageSize) {
    const fmPreset = PAGE_SIZES_MM[fm.pageSize];
    if (fmPreset) {
      pageSizeMm = fmPreset;
      pageSizeLabel = fm.pageSize;
    } else if (fm.pageSize.toLowerCase() === 'custom') {
      pageSizeMm = {
        width: clampMm(fm.pageWidthMm, 50, 500, settingsDefaults.customWidthMm),
        height: clampMm(fm.pageHeightMm, 50, 500, settingsDefaults.customHeightMm),
      };
      pageSizeLabel = 'Custom';
    } else {
      // Unknown preset: fall back to settings.
      pageSizeMm = pageSizeFromSettings(settingsDefaults);
      pageSizeLabel = settingsDefaults.pageSize;
    }
  } else {
    pageSizeMm = pageSizeFromSettings(settingsDefaults);
    pageSizeLabel = settingsDefaults.pageSize;
  }

  // ---- Margins ----------------------------------------------------------
  let marginMm: { top: number; right: number; bottom: number; left: number };
  if (fm.margin || fm.marginTopMm !== undefined) {
    if (typeof fm.margin === 'string') {
      const preset = MARGIN_PRESETS_MM[fm.margin];
      if (preset !== undefined) {
        marginMm = { top: preset, right: preset, bottom: preset, left: preset };
      } else {
        const asMm = parseMmNumber(fm.margin);
        if (Number.isFinite(asMm)) {
          const v = clampMm(asMm, 5, 100, 15);
          marginMm = { top: v, right: v, bottom: v, left: v };
        } else {
          marginMm = marginFromSettings(settingsDefaults);
        }
      }
    } else {
      marginMm = marginFromSettings(settingsDefaults);
    }
    if (
      fm.marginTopMm !== undefined ||
      fm.marginRightMm !== undefined ||
      fm.marginBottomMm !== undefined ||
      fm.marginLeftMm !== undefined
    ) {
      marginMm = {
        top: clampMm(fm.marginTopMm, 5, 100, marginMm.top),
        right: clampMm(fm.marginRightMm, 5, 100, marginMm.right),
        bottom: clampMm(fm.marginBottomMm, 5, 100, marginMm.bottom),
        left: clampMm(fm.marginLeftMm, 5, 100, marginMm.left),
      };
    }
  } else {
    marginMm = marginFromSettings(settingsDefaults);
  }

  const fontFamily =
    typeof fm.fontFamily === 'string' && fm.fontFamily.trim()
      ? fm.fontFamily.trim()
      : settingsDefaults.fontFamily;
  const fontSizePt =
    typeof fm.fontSizePt === 'number' && Number.isFinite(fm.fontSizePt)
      ? Math.max(6, Math.min(36, fm.fontSizePt))
      : settingsDefaults.fontSize;
  const footer = typeof fm.footer === 'boolean' ? fm.footer : settingsDefaults.footer;

  return {
    pageSizeMm,
    pageSizeLabel,
    marginMm,
    fontFamily,
    fontSizePt,
    footer,
    codeTheme: settingsDefaults.codeTheme,
    toc,
  };
}

function pageSizeFromSettings(s: PdfDefaults): { width: number; height: number } {
  if (s.pageSize === 'Custom') {
    return {
      width: clampMm(s.customWidthMm, 50, 500, 210),
      height: clampMm(s.customHeightMm, 50, 500, 297),
    };
  }
  return PAGE_SIZES_MM[s.pageSize] ?? PAGE_SIZES_MM.A4;
}

function marginFromSettings(s: PdfDefaults): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (s.margin === 'Custom') {
    return {
      top: clampMm(s.customMarginTopMm, 5, 100, 15),
      right: clampMm(s.customMarginRightMm, 5, 100, 15),
      bottom: clampMm(s.customMarginBottomMm, 5, 100, 15),
      left: clampMm(s.customMarginLeftMm, 5, 100, 15),
    };
  }
  const v = MARGIN_PRESETS_MM[s.margin] ?? 15;
  return { top: v, right: v, bottom: v, left: v };
}

/**
 * Has the user explicitly opted into v2.5 PDF defaults? Compares against
 * the *factory* `defaultPdfDefaults()` — if every field matches we treat
 * Settings as untouched and let the renderer use its native defaults.
 */
export function userTouchedPdfDefaults(s: PdfDefaults): boolean {
  const d = defaultPdfDefaults();
  return (
    s.pageSize !== d.pageSize ||
    s.customWidthMm !== d.customWidthMm ||
    s.customHeightMm !== d.customHeightMm ||
    s.margin !== d.margin ||
    s.customMarginTopMm !== d.customMarginTopMm ||
    s.customMarginRightMm !== d.customMarginRightMm ||
    s.customMarginBottomMm !== d.customMarginBottomMm ||
    s.customMarginLeftMm !== d.customMarginLeftMm ||
    s.fontFamily !== d.fontFamily ||
    s.fontSize !== d.fontSize ||
    s.footer !== d.footer ||
    s.codeTheme !== d.codeTheme
  );
}

