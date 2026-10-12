import type { NodeObj } from 'mind-elixir';
import { isSafeColor } from './mindmap-display.ts';
import { isSafeLink } from './mindmap-format.ts';

export { isSafeLink };

export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 40;
export const NODE_ICONS: readonly string[] = ['⭐', '✅', '❌', '⚠️', '📝', '💡', '📌', '🔍', '🔥', '📅', '⏳', '🔒', '🚀', '🎯', '💬', '🌍', '❤️', '🔄'];

export type NodeField = 'color' | 'background' | 'fontSize' | 'bold' | 'branchColor' | 'tags' | 'icons' | 'hyperLink' | 'note';
export type NodePatchResult = { ok: true; patch: Partial<NodeObj> } | { ok: false; reason: 'invalid' };
type FieldValue = string | number | boolean | null;
type NodeStyle = NonNullable<NodeObj['style']>;

const ANGLE_BRACKET_PATTERN = /[<>]/g;
const TAG_SEPARATOR = ',';
const BOLD_WEIGHT = 'bold';
const CLEARED_STYLE_VALUE = '';
const PX = 'px';
const INVALID: NodePatchResult = { ok: false, reason: 'invalid' };

export function toggleIcon(icons: readonly string[] | undefined, icon: string): string[] {
  const current = icons ?? [];
  return current.includes(icon) ? current.filter((i) => i !== icon) : [...current, icon];
}

function withStyle(node: NodeObj, key: keyof NodeStyle, value: string | null): NodePatchResult {
  const style: NodeStyle = { ...(node.style ?? {}) };
  style[key] = value ?? CLEARED_STYLE_VALUE;
  return { ok: true, patch: { style } };
}

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
  if (typeof value !== 'string') return { ok: true, patch: { icons: undefined } };
  const icons = value.split(TAG_SEPARATOR).filter((icon) => NODE_ICONS.includes(icon));
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
    case 'note': return { ok: true, patch: { note: typeof value === 'string' && value !== '' ? value : undefined } };
  }
}
