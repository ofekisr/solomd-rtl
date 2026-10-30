// Tags that markdown-it will treat as HTML blocks when they start at column 0
// AND are surrounded by blank lines. mineru / many AI-PDF-to-Markdown tools
// emit `<table>...</table>` indented 4 spaces or wedged between text lines
// without blank-line separators, which makes markdown-it treat the chunk as
// a code block (4-space indent) or escape it as inline HTML inside a
// paragraph. The preprocessor pulls these tags back to column 0 and inserts
// blank lines around them so the HTML-block rule fires. See issue #71.
const HTML_BLOCK_PASSTHROUGH_TAGS = [
  'table',
  'div',
  'details',
  'figure',
  'iframe',
  'blockquote',
  'pre',
  'section',
  'article',
  'aside',
];
const HTML_BLOCK_RE = new RegExp(
  `^([ \\t]*)(<(?:${HTML_BLOCK_PASSTHROUGH_TAGS.join('|')})\\b[\\s\\S]*?</(?:${HTML_BLOCK_PASSTHROUGH_TAGS.join('|')})>)[ \\t]*$`,
  'gmi',
);

/** Preprocess: ensure block-level HTML elements (like `<table>` emitted by
 *  mineru) are at column 0 with blank lines around them so markdown-it parses
 *  them as HTML blocks rather than indented code or inline HTML inside a
 *  paragraph. Skipped inside fenced code blocks so we don't mangle code
 *  examples.
 */
export function unwrapInlineHtmlBlocks(source: string): string {
  // Split on fenced code blocks (``` or ~~~) and only transform the non-code
  // segments. Lightweight split — markdown-it's own fence parser is the
  // authority but this approximation is sufficient for the common case.
  const FENCE_RE = /(^|\n)(```|~~~)[^\n]*\n[\s\S]*?\n\2[ \t]*(?=\n|$)/g;
  const segments: { text: string; isFence: boolean }[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FENCE_RE.exec(source)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ text: source.slice(lastIndex, m.index), isFence: false });
    }
    segments.push({ text: m[0], isFence: true });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < source.length) {
    segments.push({ text: source.slice(lastIndex), isFence: false });
  }
  return segments
    .map((seg) => {
      if (seg.isFence) return seg.text;
      return seg.text.replace(HTML_BLOCK_RE, (_match, _indent, html) => {
        return `\n\n${html}\n\n`;
      });
    })
    .join('');
}

// ---- Malformed table-delimiter normalization ------------------------------
// GFM (and markdown-it) require the delimiter row (the `|---|---|` line under
// the header) to have EXACTLY the same number of cells as the header row. If
// it doesn't — one cell too many or too few — markdown-it rejects the *entire*
// block and renders it as a plain paragraph, so the whole table collapses into
// literal `| … |` text in the preview. AI/LLM exports and PDF-to-Markdown tools
// frequently emit a stray extra `|---|` cell in the delimiter row (e.g. a
// 3-column header with a 4-cell delimiter), which silently breaks the table.
// Typora/Obsidian tolerate this; we do too — same philosophy as the list-indent
// and inline-HTML-block fixups above.
const TABLE_DELIM_CELL_RE = /^\s*:?-+:?\s*$/;

/** Split a table row on unescaped `|` (a `\|` is a literal pipe in a cell). */
function splitTableRow(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '\\' && i + 1 < line.length) {
      cur += c + line[i + 1];
      i++;
      continue;
    }
    if (c === '|') {
      cells.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  cells.push(cur);
  return cells;
}

/** Cell count as markdown-it sees it: split on `|`, drop the empty leading /
 *  trailing cells produced by an outer `| … |` border. */
function tableRowCells(line: string): string[] {
  const cells = splitTableRow(line.trim());
  if (cells.length && cells[0].trim() === '') cells.shift();
  if (cells.length && cells[cells.length - 1].trim() === '') cells.pop();
  return cells;
}

function isTableDelimiterRow(line: string): boolean {
  const cells = tableRowCells(line);
  if (cells.length === 0) return false;
  // Tolerate empty cells (AI exports emit `| --- |  | --- |`); markdown-it
  // rejects those outright, but as long as there's at least one real `---`
  // cell and no cell holds actual content, it's a mangled delimiter row we
  // can repair. Requiring ≥1 real cell keeps an all-empty `|  |  |` — which
  // is a data row, not a delimiter — from being misclassified.
  let hasRealCell = false;
  for (const c of cells) {
    if (c.trim() === '') continue;
    if (!TABLE_DELIM_CELL_RE.test(c)) return false;
    hasRealCell = true;
  }
  return hasRealCell;
}

/** Rebuild one delimiter cell, preserving its alignment colons. */
function normalizeDelimiterCell(raw: string | undefined): string {
  const t = (raw ?? '').trim();
  const left = t.startsWith(':');
  const right = t.endsWith(':');
  if (left && right) return ':---:';
  if (right) return '---:';
  if (left) return ':---';
  return '---';
}

/** When a delimiter row is malformed — its cell count differs from the header,
 *  or it contains an empty cell markdown-it rejects — rewrite it to exactly the
 *  header's column count, padding missing cells with `---`, dropping surplus
 *  ones, and keeping each surviving cell's alignment. Fenced code is skipped so
 *  `| a | b |` samples inside ``` blocks are left untouched. */
export function normalizeTableDelimiters(source: string): string {
  const lines = source.split('\n');
  const out: string[] = [];
  let inFence = false;
  let fenceChar = '';
  const fenceRe = /^(\s*)(```+|~~~+)/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fm = fenceRe.exec(line);
    if (fm) {
      if (!inFence) {
        inFence = true;
        fenceChar = fm[2][0];
        out.push(line);
        continue;
      }
      if (fm[2][0] === fenceChar) {
        inFence = false;
        out.push(line);
        continue;
      }
    }
    if (inFence) {
      out.push(line);
      continue;
    }

    const next = lines[i + 1];
    const headerLooksTabular = line.includes('|') && line.trim() !== '';
    if (
      headerLooksTabular &&
      next !== undefined &&
      next.includes('|') &&
      isTableDelimiterRow(next)
    ) {
      const headerCells = tableRowCells(line);
      const delimCells = tableRowCells(next);
      // Repair when the delimiter's column count differs from the header, OR
      // when it has an empty cell markdown-it would choke on. A count-matched,
      // fully-valid delimiter is left byte-for-byte untouched.
      const needsRepair =
        delimCells.length !== headerCells.length ||
        delimCells.some((c) => c.trim() === '');
      if (headerCells.length >= 1 && needsRepair) {
        const fixed: string[] = [];
        for (let k = 0; k < headerCells.length; k++) {
          fixed.push(normalizeDelimiterCell(delimCells[k]));
        }
        const indent = (next.match(/^\s*/) as RegExpMatchArray)[0];
        out.push(line); // header unchanged
        out.push(`${indent}| ${fixed.join(' | ')} |`); // corrected delimiter
        i++; // skip the original malformed delimiter
        continue;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

/**
 * #132 — re-indent nested list items to consistent 2-space steps.
 *
 * CommonMark turns content indented ≥4 spaces past its list item's content
 * column into an *indented code block*. So a sub-list a user typed with a Tab
 * (8 columns) under a 2-space parent silently renders as a code block with the
 * `*`/`**` markers shown literally. Typora / Obsidian re-indent instead of
 * punishing the typo; we do the same before parsing. We walk the document,
 * derive each marker's nesting depth from the sequence of indents seen so far,
 * and rewrite its leading whitespace to depth*2 spaces; continuation lines of
 * an item shift by the same delta. Fenced code and genuine top-level indented
 * code blocks (no enclosing list) are left untouched.
 */
export function normalizeListIndent(source: string): string {
  const expand = (ws: string): number => {
    let n = 0;
    for (const c of ws) n += c === '\t' ? 4 - (n % 4) : 1;
    return n;
  };
  const lines = source.split('\n');
  const out: string[] = [];
  // #213 — track each level's `markerWidth` (marker glyph + trailing spaces)
  // so a nested item re-indents under its PARENT's content column instead of a
  // fixed 2-space step. Ordered markers are 3+ chars wide (`1. `, `10. `), and
  // CommonMark only nests a child when it's indented by at least the parent
  // marker width — the old flat +2 left ordered sublists under-indented, so
  // markdown-it flattened them into siblings.
  const stack: { orig: number; norm: number; markerWidth: number }[] = [];
  let inFence = false;
  let fenceChar = '';
  let curDelta = 0;
  let curOrig = -1;
  const markRe = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)(.*)$/;
  const fenceRe = /^(\s*)(```+|~~~+)/;
  for (const line of lines) {
    const fm = fenceRe.exec(line);
    if (fm) {
      if (!inFence) {
        inFence = true;
        fenceChar = fm[2][0];
        out.push(line);
        continue;
      }
      if (fm[2][0] === fenceChar) {
        inFence = false;
        out.push(line);
        continue;
      }
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    const m = markRe.exec(line);
    if (m) {
      const orig = expand(m[1]);
      // Content column = marker glyph + its trailing spaces. A child list must
      // clear this to nest (CommonMark), so we re-indent children to exactly it.
      const markerWidth = m[2].length + m[3].length;
      while (stack.length && orig < stack[stack.length - 1].orig) stack.pop();
      const top = stack[stack.length - 1];
      let norm: number;
      if (top && orig === top.orig) {
        norm = top.norm;
        // Siblings can differ in marker width (`9.` → `10.`); keep this item's
        // width for ITS children.
        top.markerWidth = markerWidth;
      } else if (top && orig > top.orig) {
        norm = top.norm + top.markerWidth;
        stack.push({ orig, norm, markerWidth });
      } else {
        norm = 0;
        stack.length = 0;
        stack.push({ orig, norm, markerWidth });
      }
      curDelta = norm - orig;
      curOrig = orig;
      out.push(' '.repeat(norm) + m[2] + m[3] + m[4]);
    } else if (line.trim() === '') {
      out.push(line);
    } else {
      const leadWs = (line.match(/^\s*/) as RegExpMatchArray)[0];
      const lead = expand(leadWs);
      if (stack.length && curOrig >= 0 && lead >= curOrig) {
        out.push(' '.repeat(Math.max(0, lead + curDelta)) + line.slice(leadWs.length));
      } else {
        stack.length = 0;
        curDelta = 0;
        curOrig = -1;
        out.push(line);
      }
    }
  }
  return out.join('\n');
}


const NUMBERED_HEADING_RE = /^(\d+(?:\.\d+)+)\.?[ \t]+(\S.*?)\s*$/;
// Lines whose text ends in sentence punctuation are prose that merely opens
// with a decimal, not a section title — leave them alone.
const SENTENCE_END_RE = /[。．.！？!?，,；;、]$/;

export function numberedSectionHeadings(source: string): string {
  const lines = source.split('\n');
  const out: string[] = [];
  let inFence = false;
  let fenceChar = '';
  const fenceRe = /^(\s*)(```+|~~~+)/;
  for (const line of lines) {
    const fm = fenceRe.exec(line);
    if (fm) {
      if (!inFence) {
        inFence = true;
        fenceChar = fm[2][0];
        out.push(line);
        continue;
      }
      if (fm[2][0] === fenceChar) {
        inFence = false;
        out.push(line);
        continue;
      }
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    const m = NUMBERED_HEADING_RE.exec(line);
    if (m && !SENTENCE_END_RE.test(m[2])) {
      const depth = Math.min(6, m[1].split('.').length);
      out.push(`${'#'.repeat(depth)} ${m[1]} ${m[2]}`);
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}
