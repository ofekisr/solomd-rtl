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

const RGB_PATTERN = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i;
const TRANSPARENT = 'transparent';
const NO_BORDER = 'none';
const MIN_BORDER_PX = 0.5;

/** Computed colors come back as rgb()/rgba(); the side panel's color pickers only understand #rrggbb. */
export function cssColorToHex(value: string): string {
  const match = RGB_PATTERN.exec(value.trim());
  if (!match) return value;
  if (match[4] !== undefined && Number.parseFloat(match[4]) === 0) return TRANSPARENT;
  return `#${match.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
}

function roundPx(value: string): string {
  return `${Math.round(Number.parseFloat(value) || 0)}px`;
}

function borderOf(look: RenderedLook): string {
  const width = Number.parseFloat(look.borderTopWidth) || 0;
  if (look.borderTopStyle === NO_BORDER || width < MIN_BORDER_PX) return NO_BORDER;
  return `${Math.max(1, Math.round(width))}px ${look.borderTopStyle} ${cssColorToHex(look.borderTopColor)}`;
}

function paddingOf(look: RenderedLook): string {
  const [top, right, bottom, left] = [look.paddingTop, look.paddingRight, look.paddingBottom, look.paddingLeft].map(roundPx);
  return top === bottom && right === left ? `${top} ${right}` : `${top} ${right} ${bottom} ${left}`;
}

export function renderedStyle(look: RenderedLook): Style {
  return {
    color: cssColorToHex(look.color),
    background: cssColorToHex(look.backgroundColor),
    border: borderOf(look),
    borderRadius: roundPx(look.borderTopLeftRadius),
    fontSize: roundPx(look.fontSize),
    fontWeight: look.fontWeight,
    padding: paddingOf(look),
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
