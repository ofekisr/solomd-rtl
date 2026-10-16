import type { MindElixirData, NodeObj } from 'mind-elixir';
import { findNode } from './mindmap-gates.ts';
import { isSafeColor } from './mindmap-display.ts';
import { updateNode, type EditResult } from './mindmap-edit.ts';

const MEANING_MAX = 40;

export interface LegendEntry { meaning: string; color?: string; background?: string }
type Meta = Record<string, unknown>;

const metaOf = (node: NodeObj): Meta => (node.metadata && typeof node.metadata === 'object' ? { ...(node.metadata as Meta) } : {});

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

function styleFor(entry: LegendEntry): NodeObj['style'] {
  return { ...(entry.color ? { color: entry.color } : {}), ...(entry.background ? { background: entry.background } : {}) };
}

function emptyToUndefined<T extends object>(value: T): T | undefined {
  return Object.keys(value).length > 0 ? value : undefined;
}

export function markNode(data: MindElixirData, id: string, meaning: string | null): EditResult {
  const node = findNode(data.nodeData, id);
  if (!node) return { ok: false, error: `No node with id "${id}"` };
  const { mark: _old, ...meta } = metaOf(node);
  if (meaning === null) return updateNode(data, id, { metadata: emptyToUndefined(meta), style: undefined });
  const legend = readLegend(data.nodeData);
  const entry = legend.find((e) => e.meaning === meaning);
  if (!entry) return { ok: false, error: `Unknown meaning "${meaning}". Legend has: ${legend.map((e) => e.meaning).join(', ') || '(empty, set one with mmap_legend)'}` };
  return updateNode(data, id, { metadata: { ...meta, mark: meaning }, style: emptyToUndefined(styleFor(entry) ?? {}) });
}
