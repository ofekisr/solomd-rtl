import type { MindElixirData, NodeObj } from 'mind-elixir';
import { isBrokenGate, readGate, walkNodes } from './gates.ts';

type Arrow = NonNullable<MindElixirData['arrows']>[number];

export const GATE_ARROW_PREFIX = 'gate-arrow-';
const GATE_DASH = '6 4';
const MERMAID_HEADER = 'graph LR';
const MERMAID_ESCAPES: Record<string, string> = { '"': '#quot;', '<': '#lt;', '>': '#gt;' };
const MERMAID_UNSAFE = /["<>]/g;
const LINE_BREAKS = /\s*\r?\n\s*/g;

export interface MindmapAdjacency {
  nodes: { id: string; topic: string; isGate: boolean }[];
  edges: { from: string; to: string; kind: 'child' | 'gate' }[];
}
type Edge = MindmapAdjacency['edges'][number];

function liveGates(root: NodeObj): { gate: NodeObj; target: string }[] {
  return walkNodes(root)
    .filter((n) => readGate(n) !== null && !isBrokenGate(n, root))
    .map((gate) => ({ gate, target: readGate(gate)!.target }));
}

export function gateArrows(data: MindElixirData): Arrow[] {
  return liveGates(data.nodeData).map(({ gate, target }) => ({
    id: GATE_ARROW_PREFIX + gate.id, label: '', from: gate.id, to: target, style: { strokeDasharray: GATE_DASH },
  }));
}

export function withGateArrows(data: MindElixirData): MindElixirData {
  const copy: MindElixirData = structuredClone(data);
  copy.arrows = [...(copy.arrows ?? []), ...gateArrows(data)];
  return copy;
}

export function withoutGateArrows(data: MindElixirData): MindElixirData {
  if (!data.arrows) return data;
  return { ...data, arrows: data.arrows.filter((a) => !a.id.startsWith(GATE_ARROW_PREFIX)) };
}

function edges(root: NodeObj): Edge[] {
  const tree = walkNodes(root).flatMap((n) => (n.children ?? []).map((c): Edge => ({ from: n.id, to: c.id, kind: 'child' })));
  const gates = liveGates(root).map(({ gate, target }): Edge => ({ from: gate.id, to: target, kind: 'gate' }));
  return [...tree, ...gates];
}

function mermaidLabel(topic: string): string {
  return topic.replace(LINE_BREAKS, ' ').replace(MERMAID_UNSAFE, (ch) => MERMAID_ESCAPES[ch]);
}

export function toMermaid(data: MindElixirData): string {
  const nodes = walkNodes(data.nodeData);
  const alias = new Map(nodes.map((n, i) => [n.id, `n${i}`]));
  const decls = nodes.map((n) => `  ${alias.get(n.id)}["${mermaidLabel(n.topic)}"]`);
  const links = edges(data.nodeData).map((e) => `  ${alias.get(e.from)} ${e.kind === 'gate' ? '-.->' : '-->'} ${alias.get(e.to)}`);
  return [MERMAID_HEADER, ...decls, ...links].join('\n') + '\n';
}

export function toAdjacency(data: MindElixirData): MindmapAdjacency {
  return {
    nodes: walkNodes(data.nodeData).map((n) => ({ id: n.id, topic: n.topic, isGate: readGate(n) !== null })),
    edges: edges(data.nodeData),
  };
}
