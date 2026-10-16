import type { MindElixirData, NodeObj } from 'mind-elixir';
import { ancestorIds, canHoldChildren, findNode, readGate, walkNodes } from './mindmap-gates.ts';
import { buildIdMap, remapGates } from './mindmap-paste-remap.ts';

const ID_LENGTH = 16;

export type EditResult = { ok: true; data: MindElixirData; ids: string[] } | { ok: false; error: string };
export type RemoveResult = { ok: true; data: MindElixirData; ids: string[]; brokenGates: number } | { ok: false; error: string };
export type NodePatch = Partial<Pick<NodeObj, 'topic' | 'note' | 'tags' | 'metadata' | 'style'>>;

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export function newNodeId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, ID_LENGTH);
}

function freshCopy(node: NodeObj): NodeObj {
  const { children, ...rest } = structuredClone(node);
  const copy: NodeObj = { ...rest, id: newNodeId() };
  if (children) copy.children = children.map(freshCopy);
  return copy;
}

function parentOf(root: NodeObj, id: string): NodeObj | null {
  return walkNodes(root).find((n) => (n.children ?? []).some((c) => c.id === id)) ?? null;
}

function placeAt(parent: NodeObj, nodes: NodeObj[], index?: number): void {
  const kids = parent.children ?? [];
  const at = index === undefined ? kids.length : Math.max(0, Math.min(index, kids.length));
  parent.children = [...kids.slice(0, at), ...nodes, ...kids.slice(at)];
}

export function insertNodes(data: MindElixirData, parentId: string, nodes: readonly NodeObj[], index?: number): EditResult {
  const copy = structuredClone(data);
  const parent = findNode(copy.nodeData, parentId);
  if (!parent) return fail(`No node with id "${parentId}"`);
  if (!canHoldChildren(parent)) return fail(`"${parent.topic}" is a gate and cannot hold children`);
  const fresh = nodes.map(freshCopy);
  remapGates(fresh, buildIdMap(nodes, fresh));
  placeAt(parent, fresh, index);
  return { ok: true, data: copy, ids: fresh.map((n) => n.id) };
}

export function updateNode(data: MindElixirData, id: string, patch: NodePatch): EditResult {
  const copy = structuredClone(data);
  const node = findNode(copy.nodeData, id);
  if (!node) return fail(`No node with id "${id}"`);
  Object.assign(node, patch);
  return { ok: true, data: copy, ids: [id] };
}

export function moveNode(data: MindElixirData, id: string, parentId: string, index?: number): EditResult {
  if (id === data.nodeData.id) return fail('The root cannot move');
  if (parentId === id || (ancestorIds(data.nodeData, parentId) ?? []).includes(id)) {
    return fail('Cannot move a node under itself');
  }
  const copy = structuredClone(data);
  const from = parentOf(copy.nodeData, id);
  const to = findNode(copy.nodeData, parentId);
  if (!from || !to) return fail(`No node with id "${from ? parentId : id}"`);
  if (!canHoldChildren(to)) return fail(`"${to.topic}" is a gate and cannot hold children`);
  const node = from.children!.find((c) => c.id === id)!;
  from.children = from.children!.filter((c) => c.id !== id);
  placeAt(to, [node], index);
  return { ok: true, data: copy, ids: [id] };
}

export function removeNode(data: MindElixirData, id: string): RemoveResult {
  if (id === data.nodeData.id) return fail('The root cannot be removed');
  const copy = structuredClone(data);
  const parent = parentOf(copy.nodeData, id);
  if (!parent) return fail(`No node with id "${id}"`);
  const gone = new Set(walkNodes(findNode(copy.nodeData, id)!).map((n) => n.id));
  parent.children = parent.children!.filter((c) => c.id !== id);
  const brokenGates = walkNodes(copy.nodeData).filter((n) => gone.has(readGate(n)?.target ?? '')).length;
  return { ok: true, data: copy, ids: [id], brokenGates };
}
