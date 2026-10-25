import type { NodeObj } from 'mind-elixir';
import { nodePath } from './mindmap-node-fields.ts';

type Style = Record<string, string>;

/** The computed CSS a copied style is read from — what the node looks like, theme and level defaults included. */
export interface RenderedLook {
  readonly color: string;
  readonly backgroundColor: string;
  readonly borderTopWidth: string;
  readonly borderTopStyle: string;
  readonly borderTopColor: string;
  readonly borderTopLeftRadius: string;
  readonly fontSize: string;
  readonly fontWeight: string;
  readonly paddingTop: string;
  readonly paddingRight: string;
  readonly paddingBottom: string;
  readonly paddingLeft: string;
}

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

export function renderedStyle(look: RenderedLook): Style {
  return {
    color: look.color,
    background: look.backgroundColor,
    border: `${look.borderTopWidth} ${look.borderTopStyle} ${look.borderTopColor}`,
    borderRadius: look.borderTopLeftRadius,
    fontSize: look.fontSize,
    fontWeight: look.fontWeight,
    padding: `${look.paddingTop} ${look.paddingRight} ${look.paddingBottom} ${look.paddingLeft}`,
  };
}

function savedStyle(node: NodeObj): Style {
  return Object.fromEntries(Object.entries(node.style ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== ''));
}

/** With a rendered look, the copy reproduces what the node looks like; the node's own saved style wins over theme defaults. */
export function copyStyle(node: NodeObj, look?: RenderedLook): NodeStyle {
  const base = look ? renderedStyle(look) : {};
  return { style: { ...base, ...savedStyle(node) }, branchColor: node.branchColor };
}

/** Shared across every open map so a style copied in one tab pastes in another. */
export const styleClipboard: { value: NodeStyle | null } = { value: null };

function isSameStyle(node: NodeObj, copied: NodeStyle): boolean {
  return JSON.stringify(node.style ?? {}) === JSON.stringify(copied.style) && node.branchColor === copied.branchColor;
}

function applyStyle(node: NodeObj, copied: NodeStyle): void {
  if (Object.keys(copied.style).length === 0) delete node.style;
  else node.style = { ...copied.style } as NodeObj['style'];
  if (copied.branchColor === undefined) delete node.branchColor;
  else node.branchColor = copied.branchColor;
}

/** Replaces each node's style and branch color with the copied ones; empty values clear them. Returns the nodes that changed. */
export function pasteStyle(nodes: readonly NodeObj[], copied: NodeStyle): NodeObj[] {
  const changed = nodes.filter((node) => !isSameStyle(node, copied));
  for (const node of changed) applyStyle(node, copied);
  return changed;
}
