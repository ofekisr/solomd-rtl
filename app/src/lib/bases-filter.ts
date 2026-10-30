import type { IndexEntry } from '../stores/workspaceIndex';
import { getRawValue, inferColumns } from './bases-columns.ts';
import type {
  ColumnDef,
  Combinator,
  Filter,
  FilterGroup,
  FilterLeaf,
  FilterNode,
  FilterOp,
} from './bases-types.ts';
import { isFilterGroup } from './bases-types.ts';
import {
  asNumber,
  asString,
  isDateColumn,
  isEmpty,
  parseRelativeDuration,
  toEpochMs,
} from './bases-values.ts';

function matchFilter(
  entry: IndexEntry,
  filter: FilterLeaf,
  columns: ColumnDef[],
): boolean {
  const col = columns.find((c) => c.id === filter.column);
  if (!col) return true; // unknown column → don't filter
  const raw = getRawValue(entry, col);

  switch (filter.op) {
    // ---- emptiness ----
    case 'is-empty':
    case 'isEmpty':
      return isEmpty(raw);
    case 'isNotEmpty':
      return !isEmpty(raw);

    // ---- substring / affix ----
    case 'contains': {
      const needle = String(filter.value ?? '').toLowerCase();
      if (!needle) return true;
      return asString(raw).toLowerCase().includes(needle);
    }
    case 'notContains': {
      const needle = String(filter.value ?? '').toLowerCase();
      if (!needle) return true;
      return !asString(raw).toLowerCase().includes(needle);
    }
    case 'starts-with':
    case 'startsWith': {
      const needle = String(filter.value ?? '').toLowerCase();
      if (!needle) return true;
      return asString(raw).toLowerCase().startsWith(needle);
    }
    case 'endsWith': {
      const needle = String(filter.value ?? '').toLowerCase();
      if (!needle) return true;
      return asString(raw).toLowerCase().endsWith(needle);
    }

    // ---- equality ----
    case 'equals':
    case 'eq': {
      const want = filter.value;
      if (Array.isArray(raw)) return raw.some((x) => String(x) === String(want));
      return String(raw ?? '') === String(want ?? '');
    }
    case 'neq': {
      const want = filter.value;
      if (Array.isArray(raw)) return !raw.some((x) => String(x) === String(want));
      return String(raw ?? '') !== String(want ?? '');
    }

    // ---- regex ----
    case 'matches': {
      const pattern = String(filter.value ?? '');
      if (!pattern) return true;
      let re: RegExp;
      try {
        re = new RegExp(pattern, 'i');
      } catch {
        return false; // invalid regex never matches
      }
      return re.test(asString(raw));
    }

    // ---- tags (OR-membership) ----
    case 'has-tag': {
      // `value` may be a single tag string or an array (multi-select).
      const tags = Array.isArray(raw)
        ? raw.map((x) => String(x))
        : asString(raw)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
      const wanted = Array.isArray(filter.value)
        ? (filter.value as unknown[]).map((x) => String(x))
        : [String(filter.value ?? '')].filter(Boolean);
      if (wanted.length === 0) return true;
      // Match if entry has ANY of the wanted tags (multi-select OR semantics).
      return wanted.some((w) => tags.includes(w));
    }

    // ---- ordered comparisons (date- or number-aware) ----
    case '>':
    case 'gt': {
      if (isDateColumn(col)) {
        const a = toEpochMs(raw);
        const b = toEpochMs(filter.value);
        if (a == null || b == null) return false;
        return a > b;
      }
      const a = asNumber(raw);
      const b = asNumber(filter.value);
      if (a == null || b == null) return false;
      return a > b;
    }
    case 'gte': {
      if (isDateColumn(col)) {
        const a = toEpochMs(raw);
        const b = toEpochMs(filter.value);
        if (a == null || b == null) return false;
        return a >= b;
      }
      const a = asNumber(raw);
      const b = asNumber(filter.value);
      if (a == null || b == null) return false;
      return a >= b;
    }
    case '<':
    case 'lt': {
      if (isDateColumn(col)) {
        const a = toEpochMs(raw);
        const b = toEpochMs(filter.value);
        if (a == null || b == null) return false;
        return a < b;
      }
      const a = asNumber(raw);
      const b = asNumber(filter.value);
      if (a == null || b == null) return false;
      return a < b;
    }
    case 'lte': {
      if (isDateColumn(col)) {
        const a = toEpochMs(raw);
        const b = toEpochMs(filter.value);
        if (a == null || b == null) return false;
        return a <= b;
      }
      const a = asNumber(raw);
      const b = asNumber(filter.value);
      if (a == null || b == null) return false;
      return a <= b;
    }

    // ---- explicit date operators (always epoch-compared) ----
    case 'after': {
      const a = toEpochMs(raw);
      const b = toEpochMs(filter.value);
      if (a == null || b == null) return false;
      return a > b;
    }
    case 'before': {
      const a = toEpochMs(raw);
      const b = toEpochMs(filter.value);
      if (a == null || b == null) return false;
      return a < b;
    }
    case 'on': {
      // Same calendar day (compare on the date portion only).
      const a = toEpochMs(raw);
      const b = toEpochMs(filter.value);
      if (a == null || b == null) return false;
      const da = new Date(a);
      const db = new Date(b);
      return (
        da.getFullYear() === db.getFullYear() &&
        da.getMonth() === db.getMonth() &&
        da.getDate() === db.getDate()
      );
    }
    case 'inLast': {
      const span = parseRelativeDuration(filter.value);
      if (span == null) return false;
      const a = toEpochMs(raw);
      if (a == null) return false;
      const now = Date.now();
      return a >= now - span && a <= now;
    }

    default:
      return true; // unknown op → don't filter
  }
}

/**
 * Recursively evaluate a {@link FilterGroup} against one entry.
 *   - `all`  → every child must match (logical AND). Empty group → true.
 *   - `any`  → at least one child must match (logical OR). Empty group → false.
 *
 * Leaves and nested groups are dispatched structurally. `columns` is the
 * resolved column set (so each leaf can look up its column kind once).
 */
export function matchesGroup(
  entry: IndexEntry,
  group: FilterGroup,
  columns: ColumnDef[],
): boolean {
  const children = group.children ?? [];
  if (group.combinator === 'any') {
    if (children.length === 0) return false;
    return children.some((child) =>
      isFilterGroup(child)
        ? matchesGroup(entry, child, columns)
        : matchFilter(entry, child, columns),
    );
  }
  // 'all' (default)
  return children.every((child) =>
    isFilterGroup(child)
      ? matchesGroup(entry, child, columns)
      : matchFilter(entry, child, columns),
  );
}

/**
 * Coerce arbitrary (possibly partial / external) input into a well-formed
 * {@link FilterGroup} tree. Accepts:
 *   - a flat `Filter[]` array       → `{ combinator:'all', children:[...] }`
 *   - an already-shaped group       → normalized recursively
 *   - a single leaf object          → wrapped in an `all` group
 *   - null/undefined/garbage        → empty `all` group
 *
 * Leaves accept either `column` or `key` for the field id (the latter is the
 * shape F5's `.solomd/views/*.yml` may use); output always uses `column`.
 * Always returns plain serializable objects.
 */
export function normalizeFilterGroup(raw: unknown): FilterGroup {
  const EMPTY: FilterGroup = { combinator: 'all', children: [] };

  // Flat array of leaves (the legacy Filter[] shape).
  if (Array.isArray(raw)) {
    return {
      combinator: 'all',
      children: raw.map(normalizeNode).filter((n): n is FilterNode => n != null),
    };
  }

  if (typeof raw !== 'object' || raw == null) return EMPTY;

  const obj = raw as Record<string, unknown>;

  // Group shape.
  if ('combinator' in obj || 'children' in obj) {
    const combinator: Combinator = obj.combinator === 'any' ? 'any' : 'all';
    const childrenRaw = Array.isArray(obj.children) ? obj.children : [];
    return {
      combinator,
      children: childrenRaw
        .map(normalizeNode)
        .filter((n): n is FilterNode => n != null),
    };
  }

  // Single leaf → wrap.
  const leaf = normalizeLeaf(obj);
  return leaf ? { combinator: 'all', children: [leaf] } : EMPTY;
}

function normalizeNode(raw: unknown): FilterNode | null {
  if (typeof raw !== 'object' || raw == null) return null;
  const obj = raw as Record<string, unknown>;
  if ('combinator' in obj || 'children' in obj) {
    return normalizeFilterGroup(obj);
  }
  return normalizeLeaf(obj);
}

function normalizeLeaf(obj: Record<string, unknown>): FilterLeaf | null {
  const column =
    typeof obj.column === 'string'
      ? obj.column
      : typeof obj.key === 'string'
        ? obj.key
        : undefined;
  if (!column) return null;
  const op = (obj.op as FilterOp) ?? 'contains';
  const leaf: FilterLeaf = { column, op };
  if ('value' in obj) leaf.value = obj.value;
  return leaf;
}

/**
 * Apply a flat AND-combined filter list. Back-compat entry point: a
 * `Filter[]` is treated as `{ combinator:'all', children:[...] }`. Thin
 * wrapper over {@link matchesGroup} so the flat and tree paths share one
 * evaluator. Signature is unchanged from v2.0.
 */
export function applyFilters(
  entries: IndexEntry[],
  filters: Filter[],
  columns?: ColumnDef[],
): IndexEntry[] {
  if (!filters || filters.length === 0) return entries;
  const cols = columns ?? inferColumns(entries);
  const group: FilterGroup = { combinator: 'all', children: filters };
  return entries.filter((e) => matchesGroup(e, group, cols));
}

/**
 * Apply a recursive {@link FilterGroup} tree (the v4.6 generalized path used
 * by saved filtered views). Accepts either a flat array or a tree via
 * {@link normalizeFilterGroup}, so callers can pass loosely-typed input.
 */
export function applyFilterGroup(
  entries: IndexEntry[],
  group: FilterGroup | Filter[] | unknown,
  columns?: ColumnDef[],
): IndexEntry[] {
  const tree = normalizeFilterGroup(group);
  if (tree.children.length === 0) return entries;
  const cols = columns ?? inferColumns(entries);
  return entries.filter((e) => matchesGroup(e, tree, cols));
}
