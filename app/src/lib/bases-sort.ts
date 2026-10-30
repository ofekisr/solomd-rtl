import type { IndexEntry } from '../stores/workspaceIndex';
import { getRawValue, inferColumns } from './bases-columns.ts';
import type { ColumnDef, ColumnKind, SortSpec } from './bases-types.ts';
import { asNumber, asString, isEmpty, toEpochMs } from './bases-values.ts';

// ---------- sorting ----------

function compareForSort(a: unknown, b: unknown, kind: ColumnKind): number {
  // Empty values sink to the bottom regardless of dir, so they don't pollute
  // the head of a sort. Caller can flip the result for desc.
  const aEmpty = isEmpty(a);
  const bEmpty = isEmpty(b);
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  if (kind === 'number') {
    const an = asNumber(a) ?? 0;
    const bn = asNumber(b) ?? 0;
    return an - bn;
  }
  if (kind === 'date') {
    const am = toEpochMs(a) ?? 0;
    const bm = toEpochMs(b) ?? 0;
    return am - bm;
  }
  if (kind === 'boolean') {
    const ab = a ? 1 : 0;
    const bb = b ? 1 : 0;
    return ab - bb;
  }
  return asString(a).localeCompare(asString(b));
}

/**
 * Stable sort by a single column. Returns a new array.
 * Empties always sink to the bottom (so descending name sort doesn't put
 * blank rows on top).
 */
export function applySort(
  entries: IndexEntry[],
  sort: SortSpec | null,
  columns?: ColumnDef[],
): IndexEntry[] {
  if (!sort) return entries;
  const cols = columns ?? inferColumns(entries);
  const col = cols.find((c) => c.id === sort.column);
  if (!col) return entries;
  const out = entries.slice();
  const sign = sort.dir === 'asc' ? 1 : -1;
  out.sort((a, b) => {
    const av = getRawValue(a, col);
    const bv = getRawValue(b, col);
    const cmp = compareForSort(av, bv, col.kind);
    // Empties always sink. compareForSort returns +1/-1 for emptiness; only
    // flip the dir for the real comparisons.
    const aEmpty = isEmpty(av);
    const bEmpty = isEmpty(bv);
    if (aEmpty || bEmpty) return cmp;
    return cmp * sign;
  });
  return out;
}
