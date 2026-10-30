import type { IndexEntry } from '../stores/workspaceIndex';
import type { ColumnDef, ColumnKind } from './bases-types.ts';

// ---------- column inference ----------

const ISO_8601_RE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** Returns true if a string looks like an ISO 8601 date or date-time. */
export function isIsoDate(s: unknown): boolean {
  return typeof s === 'string' && ISO_8601_RE.test(s);
}

function kindOfValue(v: unknown): ColumnKind {
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'number' && Number.isFinite(v)) return 'number';
  if (typeof v === 'string') {
    if (isIsoDate(v)) return 'date';
    // Number stored as string?
    if (v.trim() !== '' && !isNaN(Number(v))) return 'number';
    return 'text';
  }
  return 'text';
}

/**
 * Pick the dominant kind across a list of seen values. Tiebreakers:
 *   array > date > number > boolean > text
 * (most informative wins; "text" is the catch-all fallback).
 */
function dominantKind(kinds: ColumnKind[]): ColumnKind {
  if (kinds.length === 0) return 'text';
  const order: ColumnKind[] = ['array', 'date', 'number', 'boolean', 'text'];
  const counts = new Map<ColumnKind, number>();
  for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
  let best: ColumnKind = 'text';
  let bestN = -1;
  for (const k of order) {
    const n = counts.get(k) ?? 0;
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

/**
 * Inspect every entry's frontmatter and return the columns to display.
 *
 * Algorithm:
 *   1. Always include builtins: name, mtime, tags.
 *   2. Count frontmatter-key occurrences across entries.
 *   3. Any key seen in >=2 entries becomes a user column.
 *   4. Infer column kind from sampled values (majority vote).
 *
 * The order is deterministic: builtins first, then user columns sorted
 * alphabetically by key.
 */
export function inferColumns(entries: IndexEntry[]): ColumnDef[] {
  const builtin: ColumnDef[] = [
    { id: 'name', label: 'Name', kind: 'text', source: 'builtin' },
    { id: 'mtime', label: 'Modified', kind: 'date', source: 'builtin' },
    { id: 'tags', label: 'Tags', kind: 'array', source: 'builtin' },
  ];

  const counts = new Map<string, number>();
  const samples = new Map<string, ColumnKind[]>();

  for (const e of entries) {
    const fm = e.frontmatter;
    if (!fm || typeof fm !== 'object') continue;
    for (const key of Object.keys(fm)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      const arr = samples.get(key) ?? [];
      arr.push(kindOfValue((fm as Record<string, unknown>)[key]));
      samples.set(key, arr);
    }
  }

  const userKeys = Array.from(counts.entries())
    .filter(([, n]) => n >= 2)
    .map(([k]) => k)
    .sort((a, b) => a.localeCompare(b));

  const userCols: ColumnDef[] = userKeys.map((k) => ({
    id: `fm:${k}`,
    label: k,
    kind: dominantKind(samples.get(k) ?? []),
    source: 'frontmatter',
    fmKey: k,
  }));

  return [...builtin, ...userCols];
}

// ---------- cell extraction ----------

/** Format an mtime (unix seconds OR ms) as `YYYY-MM-DD HH:mm`. */
export function formatMtime(mtime: number): string {
  if (!mtime || !Number.isFinite(mtime)) return '';
  // Heuristic: values < 1e12 are seconds, otherwise ms.
  const ms = mtime < 1e12 ? mtime * 1000 : mtime;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Format an ISO date string in the same canonical format as mtime. */
export function formatIsoDate(s: string): string {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const pad = (n: number) => String(n).padStart(2, '0');
  // If the original string had no time component, render date only.
  const hasTime = /[T ]\d{2}:/.test(s);
  if (!hasTime) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Read the raw (unformatted) value for a column, used for sorting/filtering. */
export function getRawValue(entry: IndexEntry, column: ColumnDef): unknown {
  if (column.source === 'builtin') {
    switch (column.id) {
      case 'name':
        return entry.name;
      case 'mtime':
        return entry.mtime;
      case 'tags':
        return entry.tags;
    }
  }
  if (column.source === 'frontmatter' && column.fmKey) {
    const fm = entry.frontmatter;
    if (!fm) return undefined;
    return (fm as Record<string, unknown>)[column.fmKey];
  }
  return undefined;
}

/**
 * Read the value for a cell, formatted for display. Returns:
 *   - string for text/date/number/boolean/missing
 *   - string (joined) for arrays
 */
export function getCellValue(entry: IndexEntry, column: ColumnDef): unknown {
  const raw = getRawValue(entry, column);
  if (raw == null || raw === '') return '';

  if (column.source === 'builtin' && column.id === 'mtime') {
    return formatMtime(typeof raw === 'number' ? raw : Number(raw));
  }
  if (column.kind === 'array') {
    if (Array.isArray(raw)) return raw.join(', ');
    return String(raw);
  }
  if (column.kind === 'date' && typeof raw === 'string') {
    return formatIsoDate(raw);
  }
  if (column.kind === 'boolean') {
    return raw ? 'true' : 'false';
  }
  if (column.kind === 'number') {
    if (typeof raw === 'number') return String(raw);
    const n = Number(raw);
    return Number.isFinite(n) ? String(n) : String(raw);
  }
  return String(raw);
}
