import type { MindElixirData, NodeObj } from 'mind-elixir';
import { findNode, isRecord, readGate, walkNodes, withGate } from './mindmap-gates.ts';

export const GATE_TOPIC_PATTERN = /^=>\s*([\w-]+)$/u;
const GATE_TOPIC_PREFIX = '=> ';

function refIdOf(node: NodeObj): string | undefined {
  const meta = node.metadata;
  return isRecord(meta) && typeof meta.refId === 'string' ? meta.refId : undefined;
}

function refIndex(root: NodeObj): Map<string, string> {
  const index = new Map<string, string>();
  for (const node of walkNodes(root)) {
    const ref = refIdOf(node);
    if (ref) index.set(ref, node.id);
  }
  return index;
}

function gateRefOf(node: NodeObj): string | undefined {
  return GATE_TOPIC_PATTERN.exec(node.topic.trim())?.[1];
}

export function attachGatesFromTopics(data: MindElixirData): MindElixirData {
  const copy: MindElixirData = structuredClone(data);
  const refs = refIndex(copy.nodeData);
  for (const node of walkNodes(copy.nodeData)) {
    const ref = gateRefOf(node);
    if (!ref) continue;
    const target = refs.get(ref);
    Object.assign(node, withGate(node, target ? { target } : { target: '', missingRef: ref }));
  }
  return copy;
}

function ensureRef(target: NodeObj): string {
  const existing = refIdOf(target);
  if (existing) return existing;
  const meta = isRecord(target.metadata) ? target.metadata : {};
  target.metadata = { ...meta, refId: target.id };
  return target.id;
}

function gateTopicOf(node: NodeObj, root: NodeObj): string | null {
  const gate = readGate(node);
  if (!gate) return null;
  const target = gate.target ? findNode(root, gate.target) : null;
  const ref = target ? ensureRef(target) : gate.missingRef;
  return ref ? GATE_TOPIC_PREFIX + ref : null;
}

export function gatesToTopics(data: MindElixirData): MindElixirData {
  const copy: MindElixirData = structuredClone(data);
  for (const node of walkNodes(copy.nodeData)) {
    const topic = gateTopicOf(node, copy.nodeData);
    if (topic) node.topic = topic;
  }
  return copy;
}
