import type { NodeObj } from 'mind-elixir';

export interface StripChip { id: string; topic: string; icons: string[]; tags: string[]; color?: string; background?: string; branch?: string }
export interface FreezeStrip { ancestors: StripChip[]; root: StripChip; level2: StripChip[]; activeLevel2Id: string | null; breadcrumb: StripChip[]; branchIndex: number | null }

type TagEntry = NonNullable<NodeObj['tags']>[number];

const LEVEL2_PATH_INDEX = 1;
const BREADCRUMB_START_INDEX = 2;
const focusByTab = new Map<string, string>();
const stripRootByTab = new Map<string, string>();

function tagText(tag: TagEntry): string {
  return typeof tag === 'string' ? tag : tag.text;
}

function chipOf(node: NodeObj): StripChip {
  return {
    id: node.id,
    topic: node.topic,
    icons: node.icons ?? [],
    tags: (node.tags ?? []).map(tagText),
    color: node.style?.color,
    background: node.style?.background,
    ...(node.branchColor ? { branch: node.branchColor } : {}),
  };
}

export function pathTo(root: NodeObj, id: string): NodeObj[] | null {
  if (root.id === id) return [root];
  for (const child of root.children ?? []) {
    const rest = pathTo(child, id);
    if (rest) return [root, ...rest];
  }
  return null;
}

function hasChildren(node: NodeObj): boolean {
  return (node.children?.length ?? 0) > 0;
}

export function anchorPath(root: NodeObj, anchorId: string | null): NodeObj[] {
  const path = anchorId === null ? null : pathTo(root, anchorId);
  const anchor = path?.[path.length - 1];
  return path && anchor && hasChildren(anchor) ? path : [root];
}

function branchIndexOf(root: NodeObj, path: readonly NodeObj[]): number | null {
  const branch = path[LEVEL2_PATH_INDEX];
  return branch ? (root.children ?? []).indexOf(branch) : null;
}

export function buildFreezeStrip(root: NodeObj, focusId: string | null, anchorId: string | null = null): FreezeStrip | null {
  if (!hasChildren(root)) return null;
  const anchors = anchorPath(root, anchorId);
  const anchor = anchors[anchors.length - 1];
  const path = focusId === null ? null : pathTo(anchor, focusId);
  return {
    ancestors: anchors.slice(0, -1).map(chipOf),
    root: chipOf(anchor),
    level2: (anchor.children ?? []).map(chipOf),
    activeLevel2Id: path?.[LEVEL2_PATH_INDEX]?.id ?? null,
    breadcrumb: (path ?? []).slice(BREADCRUMB_START_INDEX).map(chipOf),
    branchIndex: branchIndexOf(root, anchors),
  };
}

export function canAnchor(root: NodeObj, id: string): boolean {
  return anchorPath(root, id).length > 1 || id === root.id;
}

export function getTabFocus(key: string): string | null {
  return focusByTab.get(key) ?? null;
}

export function setTabFocus(key: string, id: string | null): void {
  if (id === null) focusByTab.delete(key);
  else focusByTab.set(key, id);
}

export function getTabStripRoot(key: string): string | null {
  return stripRootByTab.get(key) ?? null;
}

export function setTabStripRoot(key: string, id: string | null): void {
  if (id === null) stripRootByTab.delete(key);
  else stripRootByTab.set(key, id);
}
