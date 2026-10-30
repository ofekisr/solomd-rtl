/**
 * Pure right-sidebar layout rules: which panes show in what order, and how
 * each pane host is sized. `useRightSidebar` feeds these from reactive state.
 */

export const RS_PANE_IDS = [
  'search',
  'outline',
  'backlinks',
  'relationships',
  'tags',
  'tasks',
  'neighborhood',
  'types',
  'history',
  'inspector',
  'agent',
] as const;

export type RsPaneId = (typeof RS_PANE_IDS)[number];

export type RsPaneVisibility = Record<RsPaneId, boolean>;

export type RsPaneStyle = {
  flex?: string;
  height?: string;
  minHeight?: string;
};

const MIN_PANE_HEIGHT = '80px';

function isRsPaneId(id: string): id is RsPaneId {
  return (RS_PANE_IDS as readonly string[]).includes(id);
}

/**
 * v4.3.0 issue #57b — order follows the user's saved order; unknown ids
 * (panes shipped later) append at the end so an update keeps the layout.
 */
export function orderVisiblePanes(
  savedOrder: readonly string[] | undefined,
  visibility: RsPaneVisibility,
): RsPaneId[] {
  const ordered: RsPaneId[] = [];
  for (const id of savedOrder ?? []) {
    if (isRsPaneId(id) && !ordered.includes(id)) ordered.push(id);
  }
  for (const id of RS_PANE_IDS) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  return ordered.filter((id) => visibility[id]);
}

/**
 * Per-pane flex sizing from stored pixel heights.
 *
 * #294 — a pane alone in the strip ignores its stored height and fills it.
 * An undragged stack keeps the stylesheet's proportional shares. Once a
 * height is pinned, the bottom pane absorbs the rest so the stack always
 * reaches the bottom edge; `0 1` lets pinned panes shrink in a shorter window.
 */
export function paneFlexStyle(
  panes: readonly RsPaneId[],
  storedHeights: Readonly<Record<string, number>>,
  id: string,
): RsPaneStyle {
  if (panes.length < 2) return {};
  if (!panes.some((p) => (storedHeights[p] ?? 0) > 0)) return {};
  if (panes[panes.length - 1] === id) return { flex: '1 1 auto', minHeight: MIN_PANE_HEIGHT };
  const height = storedHeights[id];
  if (!height || height <= 0) return {};
  return { flex: `0 1 ${height}px`, height: `${height}px`, minHeight: MIN_PANE_HEIGHT };
}
