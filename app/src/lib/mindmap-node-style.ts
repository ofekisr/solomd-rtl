import type { NodeObj } from 'mind-elixir';
import { FONT_STACKS, isSafeColor, type MapFont } from './mindmap-display.ts';
import { isSafeLink } from './mindmap-format.ts';

export { isSafeLink };

export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 40;
export const NODE_ICONS: readonly string[] = ['⭐', '✅', '❌', '⚠️', '📝', '💡', '📌', '🔍', '🔥', '📅', '⏳', '🔒', '🚀', '🎯', '💬', '🌍', '❤️', '🔄'];

export const NODE_WIDTH_MIN = 40;
export const NODE_WIDTH_MAX = 800;
export const BORDER_WIDTH_MAX = 10;
export const NODE_DECORATIONS: readonly string[] = ['underline', 'line-through'];
export const NODE_BORDER_STYLES: readonly string[] = ['solid', 'dashed', 'dotted', 'double'];
export const NODE_SHAPES: Readonly<Record<string, string>> = { square: '0px', rounded: '8px', pill: '999px', circle: '50%' };

export type NodeField = 'color' | 'background' | 'fontSize' | 'bold' | 'branchColor' | 'tags' | 'icons' | 'hyperLink' | 'note'
  | 'fontFamily' | 'textDecoration' | 'width' | 'border' | 'shape' | 'radius' | 'padding';
export type NodePatchResult = { ok: true; patch: Partial<NodeObj> } | { ok: false; reason: 'invalid' };
type FieldValue = string | number | boolean | readonly string[] | null;
type NodeStyle = NonNullable<NodeObj['style']> & { borderRadius?: string; padding?: string };
export interface NodeBorder { width: number; style: string; color: string }
export interface NodePadding { vertical: number; horizontal: number }

export const PADDING_MAX = 100;
export const RADIUS_MAX = 999;

const ANGLE_BRACKET_PATTERN = /[<>]/g;
const ANGLE_BRACKET_TEST = /[<>]/;
const TAG_SEPARATOR = ',';
const BOLD_WEIGHT = 'bold';
const CLEARED_STYLE_VALUE = '';
const PX = 'px';
const INVALID: NodePatchResult = { ok: false, reason: 'invalid' };
const BORDER_PATTERN = /^(\d{1,2})px (\w+) (\S+)$/;
const PADDING_PATTERN = /^(\d{1,3})px(?: (\d{1,3})px)?(?: \d{1,3}px){0,2}$/;

export function toggleIcon(icons: readonly string[] | undefined, icon: string): string[] {
  const current = icons ?? [];
  return current.includes(icon) ? current.filter((i) => i !== icon) : [...current, icon];
}

export function setIcon(icons: readonly string[] | undefined, icon: string, isOn: boolean): string[] {
  const rest = (icons ?? []).filter((i) => i !== icon);
  return isOn ? [...rest, icon] : rest;
}

export function parseBorder(value: string | undefined): NodeBorder | null {
  const match = BORDER_PATTERN.exec(value?.trim() ?? '');
  if (!match || !NODE_BORDER_STYLES.includes(match[2]) || !isSafeColor(match[3])) return null;
  return { width: Number(match[1]), style: match[2], color: match[3] };
}

export function formatBorder(border: NodeBorder): string {
  return `${border.width}${PX} ${border.style} ${border.color}`;
}

/** Reads "Vpx Hpx" or a 4-value padding as vertical (top) / horizontal (right). */
export function parsePadding(value: string | undefined): NodePadding | null {
  const match = PADDING_PATTERN.exec(value?.trim() ?? '');
  if (!match) return null;
  const vertical = Number(match[1]);
  return { vertical, horizontal: match[2] === undefined ? vertical : Number(match[2]) };
}

export function formatPadding(padding: NodePadding): string {
  return `${padding.vertical}${PX} ${padding.horizontal}${PX}`;
}

function clampInt(value: number, max: number): number {
  return Math.min(max, Math.max(0, Math.round(value)));
}

export function fontKeyOf(family: string | undefined): MapFont | '' {
  const entry = Object.entries(FONT_STACKS).find(([, stack]) => stack === family);
  return entry ? (entry[0] as MapFont) : '';
}

export function shapeKeyOf(radius: string | undefined): string {
  return Object.entries(NODE_SHAPES).find(([, value]) => value === radius)?.[0] ?? '';
}

function withStyle(node: NodeObj, key: keyof NodeStyle, value: string | null): NodePatchResult {
  const style: NodeStyle = { ...(node.style ?? {}) };
  style[key] = value ?? CLEARED_STYLE_VALUE;
  return { ok: true, patch: { style } };
}

function isClear(value: FieldValue): boolean {
  return value === null || value === '';
}

function choicePatch(node: NodeObj, key: keyof NodeStyle, value: FieldValue, choices: Readonly<Record<string, string>>): NodePatchResult {
  if (isClear(value)) return withStyle(node, key, null);
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(choices, value) ? withStyle(node, key, choices[value]) : INVALID;
}

function widthPatch(node: NodeObj, value: FieldValue): NodePatchResult {
  if (isClear(value)) return withStyle(node, 'width', null);
  if (typeof value !== 'number' || !Number.isFinite(value)) return INVALID;
  return withStyle(node, 'width', `${Math.min(NODE_WIDTH_MAX, Math.max(NODE_WIDTH_MIN, Math.round(value)))}${PX}`);
}

function borderPatch(node: NodeObj, value: FieldValue): NodePatchResult {
  if (isClear(value)) return withStyle(node, 'border', null);
  const border = typeof value === 'string' ? parseBorder(value) : null;
  if (!border || border.width > BORDER_WIDTH_MAX) return INVALID;
  return withStyle(node, 'border', formatBorder(border));
}

function radiusPatch(node: NodeObj, value: FieldValue): NodePatchResult {
  if (isClear(value)) return withStyle(node, 'borderRadius', null);
  if (typeof value !== 'number' || !Number.isFinite(value)) return INVALID;
  return withStyle(node, 'borderRadius', `${clampInt(value, RADIUS_MAX)}${PX}`);
}

function paddingPatch(node: NodeObj, value: FieldValue): NodePatchResult {
  if (isClear(value)) return withStyle(node, 'padding', null);
  const padding = typeof value === 'string' ? parsePadding(value) : null;
  if (!padding) return INVALID;
  return withStyle(node, 'padding', formatPadding({ vertical: clampInt(padding.vertical, PADDING_MAX), horizontal: clampInt(padding.horizontal, PADDING_MAX) }));
}

const DECORATION_CHOICES = Object.fromEntries(NODE_DECORATIONS.map((d) => [d, d]));

function colorPatch(node: NodeObj, key: 'color' | 'background', value: FieldValue): NodePatchResult {
  if (value === null) return withStyle(node, key, null);
  return isSafeColor(value) ? withStyle(node, key, value.trim()) : INVALID;
}

function fontSizePatch(node: NodeObj, value: FieldValue): NodePatchResult {
  if (value === null) return withStyle(node, 'fontSize', null);
  if (typeof value !== 'number' || !Number.isFinite(value)) return INVALID;
  const size = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(value)));
  return withStyle(node, 'fontSize', `${size}${PX}`);
}

function tagsPatch(value: FieldValue): NodePatchResult {
  if (typeof value !== 'string') return { ok: true, patch: { tags: undefined } };
  const tags = value.split(TAG_SEPARATOR).map((t) => t.replace(ANGLE_BRACKET_PATTERN, '').trim()).filter(Boolean);
  return { ok: true, patch: { tags: tags.length > 0 ? tags : undefined } };
}

function linkPatch(value: FieldValue): NodePatchResult {
  if (value === null || value === '') return { ok: true, patch: { hyperLink: undefined } };
  return typeof value === 'string' && isSafeLink(value) ? { ok: true, patch: { hyperLink: value.trim() } } : INVALID;
}

function branchColorPatch(value: FieldValue): NodePatchResult {
  if (value === null) return { ok: true, patch: { branchColor: undefined } };
  return isSafeColor(value) ? { ok: true, patch: { branchColor: value.trim() } } : INVALID;
}

function iconsPatch(value: FieldValue): NodePatchResult {
  if (!Array.isArray(value)) return { ok: true, patch: { icons: undefined } };
  const icons = value.filter((icon): icon is string => typeof icon === 'string' && icon.trim() !== '' && !ANGLE_BRACKET_TEST.test(icon));
  return { ok: true, patch: { icons: icons.length > 0 ? icons : undefined } };
}

export function buildNodePatch(node: NodeObj, field: NodeField, value: FieldValue): NodePatchResult {
  switch (field) {
    case 'color':
    case 'background':
      return colorPatch(node, field, value);
    case 'fontSize': return fontSizePatch(node, value);
    case 'bold': return withStyle(node, 'fontWeight', value === true ? BOLD_WEIGHT : null);
    case 'branchColor': return branchColorPatch(value);
    case 'tags': return tagsPatch(value);
    case 'icons': return iconsPatch(value);
    case 'hyperLink': return linkPatch(value);
    case 'fontFamily': return choicePatch(node, 'fontFamily', value, FONT_STACKS);
    case 'textDecoration': return choicePatch(node, 'textDecoration', value, DECORATION_CHOICES);
    case 'width': return widthPatch(node, value);
    case 'border': return borderPatch(node, value);
    case 'shape': return choicePatch(node, 'borderRadius', value, NODE_SHAPES);
    case 'radius': return radiusPatch(node, value);
    case 'padding': return paddingPatch(node, value);
    case 'note': return { ok: true, patch: { note: typeof value === 'string' && value !== '' ? value : undefined } };
  }
}
