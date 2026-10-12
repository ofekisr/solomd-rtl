import type { NodeObj } from 'mind-elixir';

export interface StripChip { id: string; topic: string; icons: string[]; tags: string[]; color?: string; background?: string }
export interface FreezeStrip { root: StripChip; level2: StripChip[]; activeLevel2Id: string | null; breadcrumb: StripChip[] }

type TagEntry = NonNullable<NodeObj['tags']>[number];

const LEVEL2_PATH_INDEX = 1;
const BREADCRUMB_START_INDEX = 2;
const focusByTab = new Map<string, string>();

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

export function buildFreezeStrip(root: NodeObj, focusId: string | null): FreezeStrip | null {
  const children = root.children ?? [];
  if (children.length === 0) return null;
  const path = focusId === null ? null : pathTo(root, focusId);
  return {
    root: chipOf(root),
    level2: children.map(chipOf),
    activeLevel2Id: path?.[LEVEL2_PATH_INDEX]?.id ?? null,
    breadcrumb: (path ?? []).slice(BREADCRUMB_START_INDEX).map(chipOf),
  };
}

export function getTabFocus(key: string): string | null {
  return focusByTab.get(key) ?? null;
}

export function setTabFocus(key: string, id: string | null): void {
  if (id === null) focusByTab.delete(key);
  else focusByTab.set(key, id);
}
