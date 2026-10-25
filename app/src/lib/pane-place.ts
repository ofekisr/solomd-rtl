import type { SplitDirection, TileBranch, TileLeaf, TileNode } from '../types';

export type PaneSide = 'left' | 'right' | 'up' | 'down';

export interface PlaceIds {
  pane: () => string;
  branch: () => string;
}

export interface Placement {
  root: TileNode;
  paneId: string;
}

const EVEN_SPLIT: [number, number] = [50, 50];
const SIDE_BY_SIDE_PAIR = 2;

export function sideAxis(side: PaneSide): SplitDirection {
  return side === 'left' || side === 'right' ? 'horizontal' : 'vertical';
}

function sideIndex(side: PaneSide): 0 | 1 {
  return side === 'left' || side === 'up' ? 0 : 1;
}

function leaves(node: TileNode): TileLeaf[] {
  if (node.type === 'leaf') return [node];
  return [...leaves(node.children[0]), ...leaves(node.children[1])];
}

function contains(node: TileNode, id: string): boolean {
  return leaves(node).some((leaf) => leaf.id === id);
}

function replace(root: TileNode, targetId: string, replacement: TileNode): TileNode {
  if (root.id === targetId) return replacement;
  if (root.type === 'leaf') return root;
  return {
    ...root,
    children: [replace(root.children[0], targetId, replacement), replace(root.children[1], targetId, replacement)],
  };
}

/** The leaf furthest toward `side`; across the other axis the focused pane's branch wins. */
export function outermostLeaf(node: TileNode, side: PaneSide, focusedPaneId = ''): TileLeaf {
  if (node.type === 'leaf') return node;
  if (node.direction === sideAxis(side)) return outermostLeaf(node.children[sideIndex(side)], side, focusedPaneId);
  const towardFocus = contains(node.children[1], focusedPaneId) ? 1 : 0;
  return outermostLeaf(node.children[towardFocus], side, focusedPaneId);
}

function isPairOnAxis(root: TileNode, side: PaneSide): boolean {
  return root.type === 'branch' && root.direction === sideAxis(side) && leaves(root).length === SIDE_BY_SIDE_PAIR;
}

function splitToward(root: TileNode, target: TileLeaf, side: PaneSide, tabId: string, ids: PlaceIds): Placement {
  const added: TileLeaf = { type: 'leaf', id: ids.pane(), activeTabId: tabId };
  const children: [TileNode, TileNode] = sideIndex(side) === 0 ? [added, target] : [target, added];
  const branch: TileBranch = { type: 'branch', id: ids.branch(), direction: sideAxis(side), sizes: [...EVEN_SPLIT], children };
  return { root: replace(root, target.id, branch), paneId: added.id };
}

/** Where "Open on <side>" puts a tab: a new pane while there are at most two panes on that axis,
 *  otherwise the outermost existing pane on that side. */
export function placeTabOnSide(
  root: TileNode,
  side: PaneSide,
  tabId: string,
  ids: PlaceIds,
  focusedPaneId = '',
): Placement {
  const target = outermostLeaf(root, side, focusedPaneId);
  if (root.type === 'leaf' || isPairOnAxis(root, side)) return splitToward(root, target, side, tabId, ids);
  if (target.activeTabId === tabId) return { root, paneId: target.id };
  return { root: replace(root, target.id, { ...target, activeTabId: tabId }), paneId: target.id };
}
