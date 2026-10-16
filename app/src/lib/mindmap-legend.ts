import type { MindElixirData, NodeObj } from 'mind-elixir';
import { findNode } from './mindmap-gates.ts';
import { isSafeColor } from './mindmap-display.ts';
import { updateNode, type EditResult } from './mindmap-edit.ts';

const MEANING_MAX = 40;
const MARK_STYLE_KEYS: readonly string[] = ['color', 'background'];

export interface LegendEntry { meaning: string; color?: string; background?: string }
type Meta = Record<string, unknown>;
type NodeStyle = Record<string, string>;

const metaOf = (node: NodeObj): Meta => (node.metadata && typeof node.metadata === 'object' ? { ...(node.metadata as Meta) } : {});

function emptyToUndefined<T extends object>(value: T): T | undefined {
  return Object.keys(value).length > 0 ? value : undefined;
}

function readStyle(style: NodeObj['style']): NodeStyle {
  return Object.fromEntries(Object.entries(style ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

function cleanEntry(value: unknown): LegendEntry | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.meaning !== 'string' || raw.meaning.trim() === '') return null;
  const entry: LegendEntry = { meaning: raw.meaning.trim().slice(0, MEANING_MAX) };
  if (isSafeColor(raw.color)) entry.color = raw.color;
  if (isSafeColor(raw.background)) entry.background = raw.background;
  return entry;
}

function cleanLegend(values: readonly unknown[]): LegendEntry[] {
  const seen = new Set<string>();
  return values.map(cleanEntry).filter((e): e is LegendEntry => e !== null && !seen.has(e.meaning) && !!seen.add(e.meaning));
}

export function readLegend(root: NodeObj): LegendEntry[] {
  const legend = metaOf(root).legend;
  return Array.isArray(legend) ? cleanLegend(legend) : [];
}

export function withLegend(data: MindElixirData, entries: readonly LegendEntry[]): MindElixirData {
  const copy = structuredClone(data);
  copy.nodeData.metadata = { ...metaOf(copy.nodeData), legend: cleanLegend(entries) };
  return copy;
}

function withoutMarkStyle(style: NodeObj['style']): NodeStyle | undefined {
  return emptyToUndefined(Object.fromEntries(Object.entries(readStyle(style)).filter(([key]) => !MARK_STYLE_KEYS.includes(key))));
}

function markedStyle(style: NodeObj['style'], entry: LegendEntry): NodeStyle | undefined {
  return emptyToUndefined({ ...withoutMarkStyle(style), ...(entry.color ? { color: entry.color } : {}), ...(entry.background ? { background: entry.background } : {}) });
}

function applyMark(data: MindElixirData, id: string, node: NodeObj, meaning: string): EditResult {
  const legend = readLegend(data.nodeData);
  const entry = legend.find((e) => e.meaning === meaning);
  if (!entry) return { ok: false, error: `Unknown meaning "${meaning}". Legend has: ${legend.map((e) => e.meaning).join(', ') || '(empty, set one with mmap_legend)'}` };
  const { mark: _old, ...meta } = metaOf(node);
  return updateNode(data, id, { metadata: { ...meta, mark: meaning }, style: markedStyle(node.style, entry) });
}

function clearMark(data: MindElixirData, id: string, node: NodeObj): EditResult {
  if (!('mark' in metaOf(node))) return { ok: true, data: structuredClone(data), ids: [id] };
  const { mark: _old, ...meta } = metaOf(node);
  return updateNode(data, id, { metadata: emptyToUndefined(meta), style: withoutMarkStyle(node.style) });
}

export function markNode(data: MindElixirData, id: string, meaning: string | null): EditResult {
  const node = findNode(data.nodeData, id);
  if (!node) return { ok: false, error: `No node with id "${id}"` };
  if (meaning === null) return clearMark(data, id, node);
  return applyMark(data, id, node, meaning.trim());
}
