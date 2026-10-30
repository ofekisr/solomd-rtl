import type { CitationEntry } from './citations.ts';
// ---------------------------------------------------------------------------
// BibTeX parsing
// ---------------------------------------------------------------------------

/**
 * Strip enclosing `{...}` or `"..."` and unwrap inner `{...}` groups (used
 * for protecting capitalisation). We do it iteratively so `{{Smith}}` →
 * `Smith`. We also collapse runs of whitespace because BibTeX files line-
 * wrap field values frequently.
 */
function cleanBibValue(raw: string): string {
  let v = raw.trim();
  // Strip outer wrappers repeatedly: `{ {x} }` → `x`.
  // Only one layer of quotes vs braces though.
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  while (v.startsWith('{') && v.endsWith('}')) {
    // Make sure outer braces actually wrap the whole string (not e.g.
    // `{Smith} and {Jones}`).
    let depth = 0;
    let wraps = true;
    for (let i = 0; i < v.length; i++) {
      const c = v[i];
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0 && i < v.length - 1) {
          wraps = false;
          break;
        }
      }
    }
    if (!wraps) break;
    v = v.slice(1, -1);
  }
  // Strip remaining inner braces (capitalisation guards).
  v = v.replace(/[{}]/g, '');
  // Collapse whitespace.
  v = v.replace(/\s+/g, ' ').trim();
  return v;
}

/**
 * Walk a single `@type{key, …}` entry. Returns the entry plus the index of
 * the closing brace (so the outer loop can resume). `start` should point at
 * the `@`.
 */
function parseBibEntry(
  src: string,
  start: number
): { entry: CitationEntry | null; end: number } {
  // Match `@type{` (or `@type(` — rare but legal).
  const head = /@(\w+)\s*[\{(]/y;
  head.lastIndex = start;
  const m = head.exec(src);
  if (!m) return { entry: null, end: start + 1 };
  const type = m[1].toLowerCase();
  // Skip BibTeX directives like @comment, @preamble, @string.
  if (type === 'comment' || type === 'preamble' || type === 'string') {
    // Find matching closing brace at depth 0.
    return { entry: null, end: skipBraces(src, head.lastIndex - 1) };
  }
  let i = head.lastIndex;
  // The first comma separates the key from fields.
  let commaIdx = -1;
  let depth = 1;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '{') depth++;
    else if (c === '}' || c === ')') {
      depth--;
      if (depth === 0) {
        commaIdx = -1;
        return {
          entry: { key: src.slice(i, j).trim(), type },
          end: j + 1,
        };
      }
    } else if (c === ',' && depth === 1) {
      commaIdx = j;
      break;
    }
  }
  if (commaIdx < 0) return { entry: null, end: i };
  const key = src.slice(i, commaIdx).trim();
  const entry: CitationEntry = { key, type };

  // Now parse field=value pairs until matching closing brace.
  let p = commaIdx + 1;
  while (p < src.length) {
    // Skip leading whitespace + commas.
    while (p < src.length && /[\s,]/.test(src[p])) p++;
    if (p >= src.length) break;
    if (src[p] === '}' || src[p] === ')') {
      return { entry, end: p + 1 };
    }
    // Read field name.
    const fieldStart = p;
    while (p < src.length && /[\w-]/.test(src[p])) p++;
    if (p === fieldStart) {
      p++;
      continue;
    }
    const field = src.slice(fieldStart, p).toLowerCase();
    // Skip whitespace + `=`.
    while (p < src.length && /\s/.test(src[p])) p++;
    if (src[p] !== '=') {
      // malformed — skip to next comma at depth 1
      while (p < src.length && src[p] !== ',' && src[p] !== '}') p++;
      continue;
    }
    p++;
    while (p < src.length && /\s/.test(src[p])) p++;
    // Read the value: `{...}`, `"..."`, or a bare number/word.
    let valueStart = p;
    let valueEnd = p;
    if (src[p] === '{') {
      let d = 1;
      p++;
      const vs = p - 1;
      while (p < src.length && d > 0) {
        const c = src[p];
        if (c === '{') d++;
        else if (c === '}') d--;
        if (d === 0) break;
        p++;
      }
      valueStart = vs;
      valueEnd = p + 1;
      p++;
    } else if (src[p] === '"') {
      const vs = p;
      p++;
      while (p < src.length && src[p] !== '"') {
        if (src[p] === '\\') p++;
        p++;
      }
      valueStart = vs;
      valueEnd = p + 1;
      p++;
    } else {
      const vs = p;
      while (p < src.length && !/[,}\)\s]/.test(src[p])) p++;
      valueStart = vs;
      valueEnd = p;
    }
    const value = cleanBibValue(src.slice(valueStart, valueEnd));
    assignBibField(entry, field, value);
  }
  return { entry, end: p };
}

function assignBibField(entry: CitationEntry, field: string, value: string) {
  switch (field) {
    case 'author':
      entry.author = value;
      break;
    case 'title':
      entry.title = value;
      break;
    case 'year':
      entry.year = value;
      break;
    case 'date':
      // BibLaTeX uses `date = {2021-05-12}` → keep just the year.
      if (!entry.year) {
        const m = value.match(/(\d{4})/);
        if (m) entry.year = m[1];
      }
      break;
    case 'journal':
    case 'journaltitle':
      entry.journal = value;
      break;
    case 'booktitle':
      entry.booktitle = value;
      break;
    case 'publisher':
      entry.publisher = value;
      break;
    case 'editor':
      entry.editor = value;
      break;
    case 'doi':
      entry.doi = value;
      break;
    case 'url':
      entry.url = value;
      break;
  }
}

/** Find matching `}` (or `)`) starting at the given open-brace index. */
function skipBraces(src: string, openIdx: number): number {
  const open = src[openIdx];
  const close = open === '(' ? ')' : '}';
  let depth = 1;
  for (let i = openIdx + 1; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return src.length;
}

export function parseBibFile(content: string): CitationEntry[] {
  const out: CitationEntry[] = [];
  // Strip BibTeX % comments line by line — pandoc treats `%` as a comment
  // start when not inside braces.
  const stripped = content
    .split('\n')
    .map((line) => {
      // Naive: only strip if `%` is the first non-whitespace char OR
      // appears outside any obvious quoted region. Field values rarely
      // contain `%`, so this is fine.
      const t = line.trimStart();
      if (t.startsWith('%')) return '';
      return line;
    })
    .join('\n');
  let i = 0;
  while (i < stripped.length) {
    const at = stripped.indexOf('@', i);
    if (at < 0) break;
    const { entry, end } = parseBibEntry(stripped, at);
    if (entry && entry.key) out.push(entry);
    i = Math.max(end, at + 1);
  }
  return out;
}
