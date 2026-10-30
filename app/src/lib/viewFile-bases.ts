import {
  matchesGroup as basesMatchesGroup,
  type ColumnDef,
  type FilterGroup as BasesFilterGroup,
  type FilterNode as BasesFilterNode,
  type FilterLeaf as BasesFilterLeaf,
  type FilterOp as BasesFilterOp,
} from './bases';
import type { IndexEntry } from '../stores/workspaceIndex';
import {
  compileSafeUserRegex,
  isFilterGroup,
  toList,
  type FilterGroup,
  type FilterLeaf,
} from './viewFile-types.ts';

// ---------------------------------------------------------------------------
// View → bases translation. The view vocabulary is a friendly superset of
// bases' canonical ops; we lower it so the SINGLE bases engine does matching.
// ---------------------------------------------------------------------------

/** A sentinel that can never equal a real file name (always-false leaf). */
const NEVER_LEAF: BasesFilterLeaf = { column: 'name', op: 'eq', value: ' __no_match__' };
/**
 * Always-TRUE leaf (a file `name` is never empty). Used to lower a "no-op"
 * view leaf — an empty `any_of`/`none_of`/`regex` value — so it doesn't filter
 * anything out (the historical F5 semantics: a blank value = no constraint).
 */
const ALWAYS_LEAF: BasesFilterLeaf = { column: 'name', op: 'isNotEmpty' };

/**
 * Lower a single view leaf into a bases `FilterNode`. Most ops are a direct
 * alias; `any_of`/`none_of` expand into a nested group; `regex` is validated
 * (a dangerous/invalid pattern becomes an always-false leaf so it can't hang
 * or accidentally match); relationship ops should already be lowered by the
 * store, so any that slip through here become always-false.
 */
function leafToBases(leaf: FilterLeaf): BasesFilterNode {
  const { column, value } = leaf;
  switch (leaf.op) {
    case 'contains':
      return { column, op: 'contains', value };
    case 'not_contains':
      return { column, op: 'notContains', value };
    case 'equals':
      return { column, op: 'eq', value };
    case 'not_equals':
      return { column, op: 'neq', value };
    case 'starts-with':
      return { column, op: 'startsWith', value };
    case 'has-tag':
      return { column, op: 'has-tag', value };
    case 'is-empty':
      return { column, op: 'isEmpty' };
    case 'is-not-empty':
      return { column, op: 'isNotEmpty' };
    // `before`/`after` are date-OR-number aware in bases via `lt`/`gt`.
    case 'before':
      return { column, op: 'lt', value };
    case 'after':
      return { column, op: 'gt', value };
    case 'any_of': {
      const wanted = toList(value);
      if (wanted.length === 0) return { ...ALWAYS_LEAF }; // empty list → no constraint
      return {
        combinator: 'any',
        children: wanted.map((w) => ({ column, op: 'eq' as BasesFilterOp, value: w })),
      };
    }
    case 'none_of': {
      const wanted = toList(value);
      if (wanted.length === 0) return { ...ALWAYS_LEAF };
      return {
        combinator: 'all',
        children: wanted.map((w) => ({ column, op: 'neq' as BasesFilterOp, value: w })),
      };
    }
    case 'regex': {
      const src = String(value ?? '');
      if (src === '') return { ...ALWAYS_LEAF }; // empty regex → no constraint
      // ReDoS-safe gate. A dangerous/invalid pattern matches nothing.
      return compileSafeUserRegex(src)
        ? { column, op: 'matches', value: src }
        : { ...NEVER_LEAF };
    }
    case 'linksTo':
    case 'backlinksTo':
      // Should have been lowered by the store; if not, never match.
      return { ...NEVER_LEAF };
    default:
      return { ...ALWAYS_LEAF };
  }
}

/**
 * Recursively lower a view `FilterGroup` into a bases `FilterGroup`.
 *
 * View semantics differ from bases for the empty case: an empty view group
 * matches EVERYTHING regardless of combinator ("an empty filter = all notes",
 * at any nesting depth). bases' empty `any` group is false, so we lower an
 * empty group to a single always-true leaf rather than an empty group, keeping
 * the historical F5 behavior while still using the one bases engine to match.
 */
export function toBasesGroup(group: FilterGroup): BasesFilterGroup {
  const rawChildren = group.children ?? [];
  if (rawChildren.length === 0) {
    return { combinator: 'all', children: [{ ...ALWAYS_LEAF }] };
  }
  const children: BasesFilterNode[] = rawChildren.map((child) =>
    isFilterGroup(child) ? toBasesGroup(child) : leafToBases(child),
  );
  return { combinator: group.combinator, children };
}

// ---------------------------------------------------------------------------
// Evaluation — thin adapters that delegate to the single bases engine.
// ---------------------------------------------------------------------------

/** Evaluate a single leaf against an entry (lowered to bases, then matched). */
export function matchesLeaf(
  entry: IndexEntry,
  leaf: FilterLeaf,
  columns: ColumnDef[],
): boolean {
  const node = leafToBases(leaf);
  const group: BasesFilterGroup = isBasesGroup(node)
    ? node
    : { combinator: 'all', children: [node] };
  // An empty lowered group (e.g. empty regex / empty any_of) is a no-op → true.
  if (group.children.length === 0) return true;
  return basesMatchesGroup(entry, group, columns);
}

/**
 * Recursively evaluate a view filter group. Translates the whole tree once,
 * then defers all matching to `bases.matchesGroup` — there is no separate
 * matching engine here.
 *
 * Note: a view `all`/`any` group with ZERO children matches EVERYTHING (the
 * historical F5 semantics: "an empty filter = all notes"). bases' `any` with
 * zero children would be false, so we short-circuit empties to true here
 * before delegating, preserving the documented view behavior.
 */
export function matchesGroup(
  entry: IndexEntry,
  group: FilterGroup,
  columns: ColumnDef[],
): boolean {
  if (!group.children || group.children.length === 0) return true;
  return basesMatchesGroup(entry, toBasesGroup(group), columns);
}

function isBasesGroup(node: BasesFilterNode): node is BasesFilterGroup {
  return (
    typeof node === 'object' &&
    node != null &&
    'combinator' in node &&
    Array.isArray((node as BasesFilterGroup).children)
  );
}
