export interface PdfFrontMatter {
  pageSize?: string;
  pageWidthMm?: number;
  pageHeightMm?: number;
  margin?: string;
  marginTopMm?: number;
  marginRightMm?: number;
  marginBottomMm?: number;
  marginLeftMm?: number;
  fontFamily?: string;
  fontSizePt?: number;
  footer?: boolean;
  toc?: boolean;
}

/**
 * Read the YAML `pdf:` block from a markdown body. Lightweight regex parse
 * (no YAML dep) — only handles the exact shape documented above. Unknown
 * keys are silently ignored.
 */
export function parsePdfFrontMatter(body: string): PdfFrontMatter {
  const fmMatch = body.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return {};
  const yaml = fmMatch[1];
  // Find the `pdf:` block — either a single-line flow-style or a nested
  // mapping. We grab from `pdf:` to the next top-level key (column 0
  // non-whitespace ending in `:`) or end-of-yaml.
  const pdfHeader = yaml.match(/^pdf\s*:(.*)$/m);
  if (!pdfHeader) return {};

  const idx = yaml.indexOf(pdfHeader[0]);
  const after = yaml.slice(idx + pdfHeader[0].length);
  // Lines up until the next top-level key (no leading whitespace) or EOF.
  const blockLines: string[] = [];
  for (const line of after.split('\n')) {
    if (line === '') {
      blockLines.push(line);
      continue;
    }
    if (/^\S/.test(line)) {
      // Top-level key — break.
      break;
    }
    blockLines.push(line);
  }
  // Inline form (e.g. `pdf: { pageSize: A4 }`).
  const inline = pdfHeader[1].trim();
  const inlineMatch = inline.match(/^\{([\s\S]*)\}$/);
  if (inlineMatch) {
    return parsePdfBody(splitInline(inlineMatch[1]));
  }

  return parsePdfBody(blockLines.map((l) => l.replace(/^\s{2}|^\t/, '')));
}

function splitInline(body: string): string[] {
  // `pageSize: A4, margin: 15mm` → ["pageSize: A4", "margin: 15mm"]
  return body.split(',').map((s) => s.trim()).filter(Boolean);
}

function parsePdfBody(lines: string[]): PdfFrontMatter {
  const out: Record<string, unknown> = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = stripYaml(m[2]);
    switch (key) {
      case 'pageSize':
      case 'page_size':
        out.pageSize = val;
        break;
      case 'pageWidth':
      case 'page_width':
        out.pageWidthMm = parseMmNumber(val);
        break;
      case 'pageHeight':
      case 'page_height':
        out.pageHeightMm = parseMmNumber(val);
        break;
      case 'margin':
        out.margin = val;
        break;
      case 'marginTop':
      case 'margin_top':
        out.marginTopMm = parseMmNumber(val);
        break;
      case 'marginRight':
      case 'margin_right':
        out.marginRightMm = parseMmNumber(val);
        break;
      case 'marginBottom':
      case 'margin_bottom':
        out.marginBottomMm = parseMmNumber(val);
        break;
      case 'marginLeft':
      case 'margin_left':
        out.marginLeftMm = parseMmNumber(val);
        break;
      case 'font':
      case 'fontFamily':
      case 'font_family':
        out.fontFamily = val;
        break;
      case 'fontSize':
      case 'font_size':
        out.fontSizePt = parseFloat(val);
        break;
      case 'footer':
        if (/^(true|yes|on|1)$/i.test(val)) out.footer = true;
        else if (/^(false|no|off|0)$/i.test(val)) out.footer = false;
        break;
      case 'toc':
        if (/^(true|yes|on|1)$/i.test(val)) out.toc = true;
        else if (/^(false|no|off|0)$/i.test(val)) out.toc = false;
        break;
      default:
        break;
    }
  }
  return out as PdfFrontMatter;
}

function stripYaml(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

/** Parse `15mm` / `15` / `1.5cm` / `0.59in` into mm. */
export function parseMmNumber(s: string): number {
  const m = s.match(/^([\d.]+)\s*(mm|cm|in)?$/i);
  if (!m) return NaN;
  const n = parseFloat(m[1]);
  const unit = (m[2] || 'mm').toLowerCase();
  if (unit === 'cm') return n * 10;
  if (unit === 'in') return n * 25.4;
  return n;
}
