import type { NodeObj } from 'mind-elixir';
import { nodePath } from './mindmap-node-fields.ts';

export type NodeStyle = NonNullable<NodeObj['style']>;

const PATH_SEPARATOR = ' › ';

export function nodePathText(node: NodeObj): string {
  return [...nodePath(node), node.topic].join(PATH_SEPARATOR);
}

export function nodePathsText(nodes: readonly NodeObj[]): string {
  return nodes.map(nodePathText).join('\n');
}

export function copyStyle(node: NodeObj): NodeStyle {
  return { ...(node.style ?? {}) };
}

/** Shared across every open map so a style copied in one tab pastes in another. */
export const styleClipboard: { value: NodeStyle | null } = { value: null };

function isSameStyle(a: NodeObj['style'], b: NodeStyle): boolean {
  return JSON.stringify(a ?? {}) === JSON.stringify(b);
}

/** Replaces each node's style with `style`; an empty style clears it. Returns the nodes that changed. */
export function pasteStyle(nodes: readonly NodeObj[], style: NodeStyle): NodeObj[] {
  const changed = nodes.filter((node) => !isSameStyle(node.style, style));
  const isEmpty = Object.keys(style).length === 0;
  for (const node of changed) {
    if (isEmpty) delete node.style;
    else node.style = { ...style };
  }
  return changed;
}
