import type { MindElixirData, NodeObj } from 'mind-elixir';

export interface GateMeta { target: string; missingRef?: string }

export const GATE_LABEL_PREFIX = '⇒ ';

type Meta = Record<string, unknown>;

export function isRecord(value: unknown): value is Meta {
  return typeof value === 'object' && value !== null;
}

function metaOf(node: NodeObj): Meta {
  return isRecord(node.metadata) ? node.metadata : {};
}

const REF_PATTERN = /^[\w-]+$/u;

export function readGate(node: NodeObj): GateMeta | null {
  const gate = metaOf(node).gate;
  if (!isRecord(gate) || typeof gate.target !== 'string') return null;
  const missingRef = typeof gate.missingRef === 'string' && REF_PATTERN.test(gate.missingRef) ? gate.missingRef : undefined;
  if (gate.target === '' && missingRef === undefined) return null;
  return missingRef === undefined ? { target: gate.target } : { target: gate.target, missingRef };
}

export function isGate(node: NodeObj): boolean {
  return readGate(node) !== null;
}

export function withGate(node: NodeObj, gate: GateMeta): NodeObj {
  const { children: _dropped, ...rest } = node;
  return { ...rest, metadata: { ...metaOf(node), gate } };
}

export function makeGateNode(id: string, target: NodeObj): NodeObj {
  return withGate({ id, topic: GATE_LABEL_PREFIX + target.topic }, { target: target.id });
}

export function walkNodes(root: NodeObj): NodeObj[] {
  return [root, ...(root.children ?? []).flatMap(walkNodes)];
}

export function findNode(root: NodeObj, id: string): NodeObj | null {
  return walkNodes(root).find((n) => n.id === id) ?? null;
}

function liveTarget(gate: NodeObj, root: NodeObj): NodeObj | null {
  const meta = readGate(gate);
  const target = meta && meta.target !== '' ? findNode(root, meta.target) : null;
  return target && !isGate(target) ? target : null;
}

export function isBrokenGate(gate: NodeObj, root: NodeObj): boolean {
  return isGate(gate) && liveTarget(gate, root) === null;
}

export function gateLabel(gate: NodeObj, root: NodeObj, brokenLabel: string): string {
  return GATE_LABEL_PREFIX + (liveTarget(gate, root)?.topic ?? brokenLabel);
}

export function canHoldChildren(node: NodeObj): boolean {
  return !isGate(node);
}

export function canBeGateTarget(node: NodeObj): boolean {
  return !isGate(node);
}

export function ancestorIds(root: NodeObj, id: string): string[] | null {
  if (root.id === id) return [];
  for (const child of root.children ?? []) {
    const path = ancestorIds(child, id);
    if (path) return [root.id, ...path];
  }
  return null;
}

export function withGateLabels(data: MindElixirData, brokenLabel: string): MindElixirData {
  const copy: MindElixirData = structuredClone(data);
  for (const node of walkNodes(copy.nodeData)) if (isGate(node)) node.topic = gateLabel(node, copy.nodeData, brokenLabel);
  return copy;
}
