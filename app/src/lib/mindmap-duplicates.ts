import type { MindElixirData, NodeObj } from 'mind-elixir';
import { ancestorIds, findNode, isGate, makeGateNode, readGate, walkNodes } from './mindmap-gates.ts';

export interface DuplicateGroup { key: string; ids: string[] }

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const HEX_RADIX = 16;
const MIN_GROUP_SIZE = 2;
const WHITESPACE = /\s+/g;

export function normalizeTopic(topic: string): string {
  return topic.trim().replace(WHITESPACE, ' ').toLowerCase();
}

function fnv1a(text: string): string {
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), FNV_PRIME) >>> 0;
  return hash.toString(HEX_RADIX);
}

function canonical(node: NodeObj): string {
  const gate = readGate(node);
  if (gate) return JSON.stringify(['=>', gate.target || gate.missingRef || '']);
  return JSON.stringify([normalizeTopic(node.topic), (node.children ?? []).map(canonical)]);
}

export function subtreeHash(node: NodeObj): string {
  return fnv1a(canonical(node));
}

export function findDuplicateGroups(root: NodeObj): DuplicateGroup[] {
  const groups = new Map<string, NodeObj[]>();
  for (const node of walkNodes(root).slice(1)) {
    if (isGate(node)) continue;
    const key = normalizeTopic(node.topic);
    groups.set(key, [...(groups.get(key) ?? []), node]);
  }
  return [...groups.entries()]
    .filter(([, nodes]) => nodes.length >= MIN_GROUP_SIZE && nodes.some((n) => (n.children?.length ?? 0) > 0))
    .map(([key, nodes]) => ({ key, ids: nodes.map((n) => n.id) }));
}

function isMergeable(root: NodeObj, keepId: string, dupId: string): boolean {
  if (keepId === dupId || !findNode(root, keepId) || !findNode(root, dupId)) return false;
  return !ancestorIds(root, dupId)!.includes(keepId) && !ancestorIds(root, keepId)!.includes(dupId);
}

function parentOf(root: NodeObj, id: string): NodeObj | null {
  return walkNodes(root).find((n) => n.children?.some((c) => c.id === id)) ?? null;
}

function unionChildren(keep: NodeObj, dup: NodeObj): void {
  const known = new Set((keep.children ?? []).map(canonical));
  const extra = (dup.children ?? []).filter((c) => !known.has(canonical(c)));
  if (extra.length > 0) keep.children = [...(keep.children ?? []), ...extra];
}

function retargetGates(root: NodeObj, fromId: string, toId: string): void {
  for (const node of walkNodes(root)) {
    const gate = readGate(node);
    if (gate?.target !== fromId) continue;
    node.metadata = { ...(node.metadata as Record<string, unknown>), gate: { ...gate, target: toId } };
  }
}

function pruneLinks(data: MindElixirData, dupId: string): void {
  const ids = new Set(walkNodes(data.nodeData).map((n) => n.id));
  if (data.arrows) data.arrows = data.arrows.filter((a) => ids.has(a.from) && ids.has(a.to));
  if (data.summaries) data.summaries = data.summaries.filter((s) => ids.has(s.parent) && s.parent !== dupId);
}

export function mergeIntoGate(data: MindElixirData, keepId: string, dupId: string): MindElixirData | null {
  if (!isMergeable(data.nodeData, keepId, dupId)) return null;
  const copy: MindElixirData = structuredClone(data);
  const keep = findNode(copy.nodeData, keepId)!;
  const dup = findNode(copy.nodeData, dupId)!;
  const parent = parentOf(copy.nodeData, dupId)!;
  unionChildren(keep, dup);
  parent.children = parent.children!.map((c) => (c.id === dupId ? makeGateNode(dupId, keep) : c));
  retargetGates(copy.nodeData, dupId, keepId);
  pruneLinks(copy, dupId);
  return copy;
}
