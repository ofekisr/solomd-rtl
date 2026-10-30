import { h, type ComputedRef, type Ref, type VNode } from 'vue';
import type { InlineEdit } from './tree-types.ts';

export const FTREE_EDIT = Symbol('ftree-edit');

/** #321 — how FileTreeNode draws the inline new/rename row in place. */
export interface FtreeEditApi {
  editing: Ref<InlineEdit | null>;
  editInTree: ComputedRef<boolean>;
  renderEditRow: (depth: number) => VNode | null;
}

// The indent geometry, in one place: a row's own left padding is
// `8 + depth * 12`, so level `i`'s guide line sits at `8 + i * 12`.
export const INDENT_BASE = 8;
export const INDENT_STEP = 12;

/**
 * The visual tree: one dotted vertical line per ancestor level, plus the short
 * stub that joins the row to its parent's line. A flat list of names at
 * slightly different left offsets is hard to read once a vault nests a few
 * folders deep — the guides are what make a depth obvious at a glance.
 *
 * They are absolutely positioned so they cannot disturb the row's layout
 * (padding, gap, hit-testing for drags all stay exactly as they were), and
 * `pointer-events: none` keeps them out of the way of a click.
 */
export function indentGuides(depth: number): VNode[] {
  if (depth <= 0) return [];
  const guides: VNode[] = [];
  for (let i = 0; i < depth; i++) {
    guides.push(
      h('i', {
        class: 'ftree__guide',
        style: { left: `${INDENT_BASE + i * INDENT_STEP}px` },
        'aria-hidden': 'true',
      }),
    );
  }
  guides.push(
    h('i', {
      class: 'ftree__stub',
      style: { left: `${INDENT_BASE + (depth - 1) * INDENT_STEP}px` },
      'aria-hidden': 'true',
    }),
  );
  return guides;
}
