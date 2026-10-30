/**
 * Saved-view on-disk file format (F5 — Markdown-first YAML sidecar).
 *
 * Each saved view is ONE file at `{workspace}/.solomd/views/{slug}.yml`,
 * mirroring Tolaria's "one file per view" model. No note frontmatter is
 * touched — views are standalone documents that git-round-trip cleanly.
 *
 * The filter schema REUSES the already-generalized `bases.ts` engine: a view's
 * `filters` is a {@link FilterGroup} (`combinator: 'all' | 'any'`, recursive
 * `children`). As of v4.6 M0c `bases.ts` owns the recursive all/any tree, the
 * full operator set, and the `matchesGroup` evaluator, so this module NO LONGER
 * reimplements matching. It keeps only the view-layer concerns:
 *   - the `ViewFile` shape + slug derivation,
 *   - YAML <-> object serialization (stable, round-trippable),
 *   - normalization of loosely-typed parsed YAML into a well-formed ViewFile,
 *   - the friendlier view op VOCABULARY (`not_contains`, `any_of`, `regex`, …)
 *     which is translated down to bases' canonical ops before evaluation,
 *   - ReDoS-safe regex compilation (the view UI accepts raw user patterns).
 *
 * `matchesGroup` / `matchesLeaf` below are thin adapters: they lower a view
 * `FilterGroup` into a bases `FilterGroup` and delegate to `bases.matchesGroup`.
 *
 * Relationship operators (`linksTo` / `backlinksTo`) live on the leaf as
 * regular ops; bases.ts doesn't evaluate them, so the store rewrites those
 * leaves against a precomputed wikilink adjacency map before evaluation
 * (see savedViews store). Persisting them verbatim keeps the YAML expressive.
 */
import yaml from 'js-yaml';
import type { SortSpec } from './bases';
import type {
  FilterGroup,
  FilterLeaf,
  FilterNode,
  ViewFile,
  ViewOp,
} from './viewFile-types.ts';

export {
  RELATIONSHIP_OPS,
  VIEW_OPS,
  compileSafeUserRegex,
  isFilterGroup,
  isRegexLeafInvalid,
  isRelationshipOp,
  opIsMultiValue,
  opIsOrdered,
  toList,
  type FilterGroup,
  type FilterLeaf,
  type FilterNode,
  type RelationshipOp,
  type ViewFile,
  type ViewOp,
} from './viewFile-types.ts';
export { matchesGroup, matchesLeaf, toBasesGroup } from './viewFile-bases.ts';

// ---------------------------------------------------------------------------
// Normalization of loosely-typed parsed YAML.
// ---------------------------------------------------------------------------

/**
 * Coerce arbitrary parsed input into a well-formed FilterGroup. Accepts:
 *   - a real group `{combinator, children}` (recursed),
 *   - a Tolaria-style `{all:[...]}` / `{any:[...]}` shorthand,
 *   - a bare array of leaves (wrapped as `{all: [...]}` — bases back-compat),
 *   - anything else → an empty `all` group.
 */
export function normalizeFilterGroup(raw: unknown): FilterGroup {
  if (Array.isArray(raw)) {
    return { combinator: 'all', children: raw.map(normalizeNode).filter(Boolean) as FilterNode[] };
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    // Tolaria-style `{all:[...]}` / `{any:[...]}` shorthand.
    if (Array.isArray(o.all)) {
      return { combinator: 'all', children: (o.all as unknown[]).map(normalizeNode).filter(Boolean) as FilterNode[] };
    }
    if (Array.isArray(o.any)) {
      return { combinator: 'any', children: (o.any as unknown[]).map(normalizeNode).filter(Boolean) as FilterNode[] };
    }
    if ('combinator' in o || 'children' in o) {
      const combinator = o.combinator === 'any' ? 'any' : 'all';
      const children = Array.isArray(o.children)
        ? (o.children as unknown[]).map(normalizeNode).filter(Boolean) as FilterNode[]
        : [];
      return { combinator, children };
    }
  }
  return { combinator: 'all', children: [] };
}

function normalizeNode(raw: unknown): FilterNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  // A nested group?
  if ('combinator' in o || 'children' in o || Array.isArray(o.all) || Array.isArray(o.any)) {
    return normalizeFilterGroup(o);
  }
  // A leaf — require a column + op. Accept `key` as an alias for `column`
  // (matches bases' tolerant deserialization of external YAML/JSON).
  const column =
    typeof o.column === 'string' ? o.column : typeof o.key === 'string' ? o.key : undefined;
  if (column && typeof o.op === 'string') {
    const leaf: FilterLeaf = { column, op: o.op as ViewOp };
    if ('value' in o) leaf.value = o.value;
    return leaf;
  }
  return null;
}

/** Folder (relative to the workspace root) where view files live. */
export const VIEWS_DIR = '.solomd/views';

/**
 * Derive a filesystem-safe slug from a view name. Lowercase, spaces → `-`,
 * strip anything that isn't `[a-z0-9-]`, collapse repeats. Falls back to
 * `view` when the name has no usable characters (e.g. pure punctuation or
 * CJK, which we transliterate-skip rather than mangle).
 */
export function slugify(name: string): string {
  const base = (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    // Keep only ASCII word chars + dashes for a portable filename.
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'view';
}

/** Ensure a slug is unique against an existing set (appends -2, -3, …). */
export function uniqueSlug(name: string, taken: Set<string>): string {
  const base = slugify(name);
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

/**
 * Coerce arbitrary parsed-YAML / partial input into a well-formed ViewFile.
 * `slug` is supplied by the caller (derived from the filename so renaming the
 * file renames the view) and always wins over any `slug` key in the body.
 */
export function normalizeViewFile(slug: string, raw: unknown): ViewFile {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const name =
    typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : slug;

  const icon = typeof obj.icon === 'string' && obj.icon ? obj.icon : undefined;
  const color = typeof obj.color === 'string' && obj.color ? obj.color : undefined;

  const order =
    typeof obj.order === 'number' && Number.isFinite(obj.order) ? obj.order : 0;

  const columns = Array.isArray(obj.columns)
    ? obj.columns.filter((c): c is string => typeof c === 'string')
    : [];

  const sort = normalizeSort(obj.sort);

  // Accept both `filters` (tree) and a bare `filterGroup` key for resilience.
  const filters = normalizeFilterGroup(obj.filters ?? obj.filterGroup ?? []);

  return { slug, name, icon, color, order, columns, sort, filters };
}

function normalizeSort(raw: unknown): SortSpec | null {
  if (!raw || typeof raw !== 'object') {
    // Allow `"mtime:desc"` string form too.
    if (typeof raw === 'string' && raw.includes(':')) {
      const [column, dir] = raw.split(':');
      if (column) return { column, dir: dir === 'asc' ? 'asc' : 'desc' };
    }
    return null;
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.column !== 'string' || !o.column) return null;
  return { column: o.column, dir: o.dir === 'asc' ? 'asc' : 'desc' };
}

/**
 * Serialize a ViewFile to YAML. The `slug` is intentionally NOT written (it's
 * the filename) so the file stays the single source of truth and renaming the
 * file is the way to rename the slug. Keys are emitted in a fixed order for
 * stable diffs. Undefined optionals are omitted entirely.
 */
export function serializeViewFile(view: ViewFile): string {
  const out: Record<string, unknown> = { name: view.name };
  if (view.icon) out.icon = view.icon;
  if (view.color) out.color = view.color;
  out.order = view.order;
  if (view.columns.length) out.columns = view.columns;
  if (view.sort) out.sort = { column: view.sort.column, dir: view.sort.dir };
  out.filters = view.filters;
  return yaml.dump(out, { lineWidth: 100, noRefs: true, sortKeys: false });
}

/**
 * Parse a YAML string into a ViewFile. Tolerant: malformed YAML or a
 * non-object document yields a minimal valid view (named after the slug, no
 * filters) rather than throwing, so one corrupt file can't break the panel.
 */
export function parseViewFile(slug: string, text: string): ViewFile {
  let parsed: unknown = null;
  try {
    parsed = yaml.load(text);
  } catch {
    parsed = null;
  }
  return normalizeViewFile(slug, parsed);
}

/** Build a default, empty view skeleton (used by "New view"). */
export function emptyView(slug: string, name: string): ViewFile {
  return {
    slug,
    name,
    order: 0,
    columns: [],
    sort: { column: 'mtime', dir: 'desc' },
    filters: { combinator: 'all', children: [] },
  };
}
