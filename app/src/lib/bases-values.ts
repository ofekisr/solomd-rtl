import type { ColumnDef } from './bases-types.ts';

export function asString(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

export function asNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/** True when a column is date-like (a `date` kind or the builtin mtime). */
export function isDateColumn(col: ColumnDef): boolean {
  return col.kind === 'date' || (col.source === 'builtin' && col.id === 'mtime');
}

/**
 * Parse a relative-duration token used by the `inLast` operator into a
 * millisecond span. Accepts e.g. `7d`, `2w`, `3mo`, `1y`, `12h`, `30m`,
 * or a bare number (interpreted as days). Returns null if unparseable.
 */
export function parseRelativeDuration(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v * 24 * 3600 * 1000; // bare number → days
  }
  if (typeof v !== 'string') return null;
  const m = v.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(mo|ms|[smhdwy])?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2] ?? 'd';
  const SEC = 1000;
  const MIN = 60 * SEC;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  switch (unit) {
    case 'ms':
      return n;
    case 's':
      return n * SEC;
    case 'm':
      return n * MIN;
    case 'h':
      return n * HOUR;
    case 'd':
      return n * DAY;
    case 'w':
      return n * 7 * DAY;
    case 'mo':
      return n * 30 * DAY;
    case 'y':
      return n * 365 * DAY;
    default:
      return null;
  }
}

/** Convert a cell value or filter value to epoch ms, or null if not a date. */
export function toEpochMs(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v < 1e12 ? v * 1000 : v;
  }
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return null;
}
