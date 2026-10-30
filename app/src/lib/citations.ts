/**
 * F5 citations: parse `.bib` and `.csl-json` reference databases into a
 * common shape used by autocomplete and inline preview rendering.
 *
 * The BibTeX parser here is **deliberately naive** — full BibTeX is its own
 * little programming language (string concatenation, @string macros,
 * crossref, etc.) and pandoc handles all of that on export. Our job is
 * limited to:
 *
 *   1. extracting citation keys for autocomplete,
 *   2. pulling enough author/year/title to render a useful completion
 *      detail and a `(Author Year)` style inline preview.
 *
 * Anything we miss (string macros, abbrev journals, etc.) is fine — pandoc
 * will read the file directly at export time.
 */

export interface CitationEntry {
  /** Citation key (the `@key` users type). */
  key: string;
  /** BibTeX type (article, book, inproceedings, …) or CSL `type`. */
  type: string;
  author?: string;
  title?: string;
  year?: string;
  journal?: string;
  booktitle?: string;
  publisher?: string;
  editor?: string;
  doi?: string;
  url?: string;
}

export { parseBibFile } from './citations-bibtex.ts';

// ---------------------------------------------------------------------------
// CSL-JSON parsing
// ---------------------------------------------------------------------------

interface CslJsonItem {
  id: string;
  type?: string;
  title?: string;
  author?: Array<{ family?: string; given?: string; literal?: string }>;
  editor?: Array<{ family?: string; given?: string; literal?: string }>;
  issued?: { 'date-parts'?: number[][]; literal?: string; raw?: string };
  'container-title'?: string;
  publisher?: string;
  DOI?: string;
  URL?: string;
}

function formatCslName(n: { family?: string; given?: string; literal?: string }): string {
  if (n.literal) return n.literal;
  if (n.family && n.given) return `${n.given} ${n.family}`;
  return n.family || n.given || '';
}

function formatCslNames(arr: Array<{ family?: string; given?: string; literal?: string }> | undefined): string | undefined {
  if (!arr || arr.length === 0) return undefined;
  return arr.map(formatCslName).filter(Boolean).join(' and ');
}

function cslIssuedYear(issued: CslJsonItem['issued']): string | undefined {
  if (!issued) return undefined;
  if (issued['date-parts'] && issued['date-parts'][0] && issued['date-parts'][0][0]) {
    return String(issued['date-parts'][0][0]);
  }
  if (issued.literal) {
    const m = issued.literal.match(/(\d{4})/);
    if (m) return m[1];
  }
  if (issued.raw) {
    const m = issued.raw.match(/(\d{4})/);
    if (m) return m[1];
  }
  return undefined;
}

export function parseCslJson(content: string): CitationEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: CitationEntry[] = [];
  for (const raw of parsed as CslJsonItem[]) {
    if (!raw || typeof raw !== 'object' || !raw.id) continue;
    const entry: CitationEntry = {
      key: String(raw.id),
      type: (raw.type || 'misc').toString(),
    };
    const author = formatCslNames(raw.author);
    if (author) entry.author = author;
    const editor = formatCslNames(raw.editor);
    if (editor) entry.editor = editor;
    if (raw.title) entry.title = String(raw.title);
    const year = cslIssuedYear(raw.issued);
    if (year) entry.year = year;
    if (raw['container-title']) {
      const ct = String(raw['container-title']);
      // CSL doesn't distinguish journal vs booktitle. We put it in `journal`
      // for article-likes, `booktitle` for chapter-likes.
      if (
        entry.type === 'article-journal' ||
        entry.type === 'article' ||
        entry.type === 'article-magazine' ||
        entry.type === 'article-newspaper'
      ) {
        entry.journal = ct;
      } else {
        entry.booktitle = ct;
      }
    }
    if (raw.publisher) entry.publisher = String(raw.publisher);
    if (raw.DOI) entry.doi = String(raw.DOI);
    if (raw.URL) entry.url = String(raw.URL);
    out.push(entry);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/**
 * Render a `(Author Year)` style inline preview. Falls back gracefully when
 * fields are missing — the goal is "give the user enough to recognise the
 * citation", not bibliographic correctness (pandoc handles that on export).
 */
export function formatInline(entry: CitationEntry): string {
  const author = shortAuthor(entry.author);
  const year = entry.year || 'n.d.';
  if (author) return `(${author} ${year})`;
  return `(${entry.key} ${year})`;
}

/** "Smith, John and Doe, Jane" → "Smith"; "Smith and Jones" → "Smith & Jones". */
function shortAuthor(author?: string): string | undefined {
  if (!author) return undefined;
  const parts = author.split(/\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  const surnames = parts.map(extractSurname);
  if (surnames.length === 1) return surnames[0];
  if (surnames.length === 2) return `${surnames[0]} & ${surnames[1]}`;
  return `${surnames[0]} et al.`;
}

function extractSurname(name: string): string {
  // BibTeX forms: "Last, First" OR "First Last" OR a literal like
  // "{The Beatles}" (already brace-stripped).
  if (name.includes(',')) return name.split(',')[0].trim();
  const tokens = name.trim().split(/\s+/);
  return tokens[tokens.length - 1] || name;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Lightweight fuzzy match over key + author + title + year. Not a true
 * fuzzy algorithm (no Levenshtein) — substring + prefix scoring is enough
 * for picking a citation from a few hundred refs.
 */
export function searchCitations(entries: CitationEntry[], query: string): CitationEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries.slice(0, 50);
  const ranked: Array<{ e: CitationEntry; score: number }> = [];
  for (const e of entries) {
    const keyLc = e.key.toLowerCase();
    const authorLc = (e.author || '').toLowerCase();
    const titleLc = (e.title || '').toLowerCase();
    const yearLc = (e.year || '').toLowerCase();
    let score = 0;
    if (keyLc === q) score = 200;
    else if (keyLc.startsWith(q)) score = 150;
    else if (keyLc.includes(q)) score = 100;
    if (authorLc.startsWith(q)) score = Math.max(score, 90);
    else if (authorLc.includes(q)) score = Math.max(score, 60);
    if (titleLc.startsWith(q)) score = Math.max(score, 80);
    else if (titleLc.includes(q)) score = Math.max(score, 50);
    if (yearLc === q) score = Math.max(score, 70);
    if (score > 0) ranked.push({ e, score });
  }
  ranked.sort((a, b) => b.score - a.score || a.e.key.localeCompare(b.e.key));
  return ranked.slice(0, 50).map((r) => r.e);
}
