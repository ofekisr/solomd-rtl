/** Bases data shapes: columns, filters, sort, saved views. */

export type ColumnKind = 'text' | 'date' | 'number' | 'array' | 'boolean';

export type ColumnSource = 'builtin' | 'frontmatter';

export interface ColumnDef {
  /** Stable column id used in filters/sort/saved views. */
  id: string;
  /** Human-readable header label. Defaults to id. */
  label: string;
  /** What kind of value lives here. Drives renderer + filter UI. */
  kind: ColumnKind;
  /** Where to read the cell value from. */
  source: ColumnSource;
  /** Front-matter key (only when `source === 'frontmatter'`). */
  fmKey?: string;
}

/**
 * The full operator set. The first group is the original v2.0 vocabulary
 * (kept verbatim for backward compatibility); the second group is the
 * Tolaria-parity extension added in v4.6.
 */
export type FilterOp =
  // --- original v2.0 operators (do not rename / remove) ---
  | 'contains'
  | 'equals'
  | 'starts-with'
  | '>'
  | '<'
  | 'is-empty'
  | 'has-tag'
  // --- v4.6 Tolaria-parity extension ---
  | 'eq'
  | 'neq'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'matches' // regex
  | 'before' // date <
  | 'after' // date >
  | 'on' // date ==
  | 'inLast'; // relative date window, e.g. "7d", "2w", "3mo"

export interface Filter {
  /** Column id this filter applies to. */
  column: string;
  op: FilterOp;
  /** Value to compare against. Type depends on op. */
  value?: unknown;
}

/**
 * A single predicate in a recursive filter tree. Structurally identical to
 * the flat {@link Filter}, so any `Filter` is already a valid `FilterLeaf`.
 *
 * `column` is the canonical key (a {@link ColumnDef} id such as `mtime` or
 * `fm:status`). When deserializing external YAML/JSON that used `key`
 * instead, {@link normalizeFilterGroup} maps `key` → `column`.
 */
export interface FilterLeaf {
  /** Column id (a.k.a. `key` in serialized form) this predicate reads. */
  column: string;
  op: FilterOp;
  value?: unknown;
}

export type Combinator = 'all' | 'any';

/**
 * A recursive filter tree node. `all` = logical AND of children, `any` =
 * logical OR. Children may themselves be groups, so nesting is unbounded.
 * Plain serializable object: no class instances, no functions — round-trips
 * cleanly through `JSON.parse(JSON.stringify(group))` and YAML.
 */
export interface FilterGroup {
  combinator: Combinator;
  children: FilterNode[];
}

export type FilterNode = FilterGroup | FilterLeaf;

/** Type guard: is this node a group (vs. a leaf)? */
export function isFilterGroup(node: FilterNode): node is FilterGroup {
  return (
    typeof node === 'object' &&
    node != null &&
    'combinator' in node &&
    Array.isArray((node as FilterGroup).children)
  );
}

export interface SortSpec {
  column: string;
  dir: 'asc' | 'desc';
}

export interface SavedView {
  name: string;
  /** Column ids in display order. Empty array means "auto" (all inferred). */
  columns: string[];
  /**
   * Flat AND filter list (v2.0 shape, still the canonical form for the
   * current BasesView UI). For richer all/any trees (F5 saved views) use
   * {@link filterGroup}; when present it takes precedence over `filters`.
   */
  filters: Filter[];
  /**
   * Optional recursive filter tree. Serializable plain object; round-trips
   * to/from `.solomd/views/*.yml`. When set, evaluate via
   * {@link applyFilterGroup}; `filters` is the flat-fallback projection.
   */
  filterGroup?: FilterGroup;
  sort: SortSpec | null;
}
