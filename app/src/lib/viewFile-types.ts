import type { SortSpec } from './bases';

// ---------------------------------------------------------------------------
// Recursive all/any filter tree (the Tolaria-parity vocabulary on top of
// bases.ts). The TREE SHAPE is structurally identical to bases'; only the
// op vocabulary differs, and `toBasesNode` translates it.
// ---------------------------------------------------------------------------

/** Extended operator set understood by the view layer (a friendly alias set). */
export type ViewOp =
  | 'contains'
  | 'not_contains'
  | 'equals'
  | 'not_equals'
  | 'starts-with'
  | 'before'
  | 'after'
  | 'any_of'
  | 'none_of'
  | 'is-empty'
  | 'is-not-empty'
  | 'has-tag'
  | 'regex'
  | RelationshipOp;

/** A single leaf condition in the filter tree. */
export interface FilterLeaf {
  /** Column id (bases `ColumnDef.id`: `name`/`mtime`/`tags`/`fm:<key>`). */
  column: string;
  op: ViewOp;
  /** Comparison value. Optional for is-empty / is-not-empty. */
  value?: unknown;
}

/** A boolean group: combine `children` with all (AND) or any (OR). */
export interface FilterGroup {
  combinator: 'all' | 'any';
  children: FilterNode[];
}

export type FilterNode = FilterLeaf | FilterGroup;

/** Narrow a node to a group. */
export function isFilterGroup(node: FilterNode): node is FilterGroup {
  return (
    !!node &&
    typeof node === 'object' &&
    'combinator' in node &&
    Array.isArray((node as FilterGroup).children)
  );
}

/** A view as it lives on disk + in the store. */
export interface ViewFile {
  /** Stable id derived from the filename (sans `.yml`). */
  slug: string;
  /** Human-readable view name (shown in the sidebar). */
  name: string;
  /** Optional emoji / single-char glyph rendered as the row icon. */
  icon?: string;
  /** Optional accent color (any CSS color) used to tint the icon swatch. */
  color?: string;
  /** Manual sort order in the sidebar (ascending). Lower = higher up. */
  order: number;
  /** Column ids shown as muted chips on each note row. Empty = none. */
  columns: string[];
  /** Single-column sort spec, or null for default (mtime desc). */
  sort: SortSpec | null;
  /** Recursive all/any filter tree — evaluated via bases.matchesGroup. */
  filters: FilterGroup;
}

/** Relationship operators understood at the view layer (resolved in store). */
export const RELATIONSHIP_OPS = ['linksTo', 'backlinksTo'] as const;
export type RelationshipOp = (typeof RELATIONSHIP_OPS)[number];

export function isRelationshipOp(op: string): op is RelationshipOp {
  return (RELATIONSHIP_OPS as readonly string[]).includes(op);
}

// ---------------------------------------------------------------------------
// Operator vocabulary (UI)
// ---------------------------------------------------------------------------

/** Whether an op compares ordered values (date / number). */
export function opIsOrdered(op: ViewOp): boolean {
  return op === 'before' || op === 'after';
}

/** Whether an op takes a list (comma-separated) value. */
export function opIsMultiValue(op: ViewOp): boolean {
  return op === 'any_of' || op === 'none_of';
}

/** Operators the value/op dropdowns offer, grouped for the builder UI. */
export const VIEW_OPS: { value: ViewOp; label: string; needsValue: boolean }[] = [
  { value: 'contains', label: 'contains', needsValue: true },
  { value: 'not_contains', label: 'does not contain', needsValue: true },
  { value: 'equals', label: 'equals', needsValue: true },
  { value: 'not_equals', label: 'does not equal', needsValue: true },
  { value: 'starts-with', label: 'starts with', needsValue: true },
  { value: 'has-tag', label: 'has tag', needsValue: true },
  { value: 'any_of', label: 'is any of', needsValue: true },
  { value: 'none_of', label: 'is none of', needsValue: true },
  { value: 'before', label: 'before', needsValue: true },
  { value: 'after', label: 'after', needsValue: true },
  { value: 'is-empty', label: 'is empty', needsValue: false },
  { value: 'is-not-empty', label: 'is not empty', needsValue: false },
  { value: 'regex', label: 'matches regex', needsValue: true },
  { value: 'linksTo', label: 'links to', needsValue: true },
  { value: 'backlinksTo', label: 'is linked from', needsValue: true },
];

/** Split a multi-value (`any_of`) input into a trimmed string list. */
export function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Compile a user-supplied regex in a ReDoS-resistant way: reject catastrophic
 * nested quantifiers and cap source length. Returns null on a bad/dangerous
 * pattern so the leaf simply doesn't match (rather than hanging the UI).
 */
export function compileSafeUserRegex(src: string): RegExp | null {
  if (typeof src !== 'string' || src.length === 0 || src.length > 1000) return null;
  // Heuristic guard against the classic nested-quantifier bombs: a group whose
  // body already contains an unbounded quantifier, and which is ITSELF
  // quantified — e.g. `(a+)+`, `(a*)*`, `(a+)*`, `(\d+)+`, `([a-z]*)+`. These
  // make the engine backtrack exponentially. We don't try to be a full parser;
  // we just reject the obviously dangerous shapes.
  if (/\([^()]*[+*}][^()]*\)\s*[+*]/.test(src)) return null;
  if (/\([^()]*\)\s*[+*]\s*[+*]/.test(src)) return null; // `(a)++`, `(a)**`
  try {
    return new RegExp(src, 'i');
  } catch {
    return null;
  }
}

/**
 * True when a regex leaf's source is non-empty AND fails the ReDoS-safety
 * gate. Used by the builder to flag a bad pattern in the UI.
 */
export function isRegexLeafInvalid(leaf: FilterLeaf): boolean {
  if (leaf.op !== 'regex') return false;
  const v = String(leaf.value ?? '');
  return v.length > 0 && compileSafeUserRegex(v) === null;
}
