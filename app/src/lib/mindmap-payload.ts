import type { MindElixirData, NodeObj } from 'mind-elixir';
import { canHoldChildren, findNode, walkNodes } from './mindmap-gates.ts';
import { parseMindmap, sanitizeMindmapData, serializeMindmap } from './mindmap-format.ts';
import { prefixMindmapIds } from './mindmap-merge.ts';
import { payloadOf, type PastePayload } from './mindmap-paste.ts';

export type MapTextResult = { ok: true; data: MindElixirData; payload: PastePayload } | { ok: false; error: string };
export type GraftResult = { ok: true; data: MindElixirData; rootId: string } | { ok: false; error: string };

const GROUP_ROOT_ID = 'root';
const GRAFT_PREFIX = 'm';
const PREFIX_SEPARATOR = '-';
const PAD_WIDTH = 2;
const PAD_CHAR = '0';

function topMost(nodes: NodeObj[]): NodeObj[] {
  const inside = (n: NodeObj, other: NodeObj) => other !== n && walkNodes(other).includes(n);
  return nodes.filter((n) => !nodes.some((other) => inside(n, other)));
}

function idSet(nodes: readonly NodeObj[]): Set<string> {
  return new Set(nodes.flatMap((n) => walkNodes(n).map((x) => x.id)));
}

export function subtreeData(data: MindElixirData, nodeIds: readonly string[], groupTopic: string): MindElixirData | null {
  const found = nodeIds.map((id) => findNode(data.nodeData, id)).filter((n): n is NodeObj => n !== null);
  const picked = structuredClone(topMost(found));
  if (picked.length === 0) return null;
  const nodeData = picked.length === 1 ? picked[0] : { id: GROUP_ROOT_ID, topic: groupTopic, children: picked };
  const ids = idSet(picked);
  const arrows = (data.arrows ?? []).filter((a) => ids.has(a.from) && ids.has(a.to));
  const summaries = (data.summaries ?? []).filter((s) => ids.has(s.parent));
  return { nodeData, arrows, summaries };
}

export function parseMapText(text: string, fallbackTopic: string): MapTextResult {
  const parsed = parseMindmap(text, fallbackTopic);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return { ok: true, data: parsed.data, payload: payloadOf('mmap', parsed.data) };
}

export function copyMapText(data: MindElixirData): string {
  return serializeMindmap(sanitizeMindmapData(data));
}

function freePrefix(target: MindElixirData): string {
  const ids = walkNodes(target.nodeData).map((n) => n.id);
  for (let i = 1; ; i += 1) {
    const prefix = `${GRAFT_PREFIX}${String(i).padStart(PAD_WIDTH, PAD_CHAR)}${PREFIX_SEPARATOR}`;
    if (!ids.some((id) => id.startsWith(prefix))) return prefix;
  }
}

export function graftMap(target: MindElixirData, source: MindElixirData, parentId?: string): GraftResult {
  const copy = structuredClone(target);
  const parent = findNode(copy.nodeData, parentId ?? copy.nodeData.id);
  if (!parent) return { ok: false, error: `No node with id "${parentId}"` };
  if (!canHoldChildren(parent)) return { ok: false, error: `"${parent.topic}" is a gate and cannot hold children` };
  const grafted = prefixMindmapIds(sanitizeMindmapData(source), freePrefix(copy));
  parent.children = [...(parent.children ?? []), grafted.nodeData];
  copy.arrows = [...(copy.arrows ?? []), ...(grafted.arrows ?? [])];
  copy.summaries = [...(copy.summaries ?? []), ...(grafted.summaries ?? [])];
  return { ok: true, data: copy, rootId: grafted.nodeData.id };
}
