import type { NodeObj } from 'mind-elixir';
import { nodePath } from './mindmap-node-fields.ts';

type Style = NonNullable<NodeObj['style']>;

export interface NodeStyle {
  readonly style: Style;
  readonly branchColor?: string;
}

const PATH_SEPARATOR = ' › ';

export function nodePathText(node: NodeObj): string {
  return [...nodePath(node), node.topic].join(PATH_SEPARATOR);
}

export function nodePathsText(nodes: readonly NodeObj[]): string {
  return nodes.map(nodePathText).join('\n');
}

export function copyStyle(node: NodeObj): NodeStyle {
  return { style: { ...(node.style ?? {}) }, branchColor: node.branchColor };
}

/** Shared across every open map so a style copied in one tab pastes in another. */
export const styleClipboard: { value: NodeStyle | null } = { value: null };

function isSameStyle(node: NodeObj, copied: NodeStyle): boolean {
  return JSON.stringify(node.style ?? {}) === JSON.stringify(copied.style) && node.branchColor === copied.branchColor;
}

function applyStyle(node: NodeObj, copied: NodeStyle): void {
  if (Object.keys(copied.style).length === 0) delete node.style;
  else node.style = { ...copied.style };
  if (copied.branchColor === undefined) delete node.branchColor;
  else node.branchColor = copied.branchColor;
}

/** Replaces each node's style and branch color with the copied ones; empty values clear them. Returns the nodes that changed. */
export function pasteStyle(nodes: readonly NodeObj[], copied: NodeStyle): NodeObj[] {
  const changed = nodes.filter((node) => !isSameStyle(node, copied));
  for (const node of changed) applyStyle(node, copied);
  return changed;
}
