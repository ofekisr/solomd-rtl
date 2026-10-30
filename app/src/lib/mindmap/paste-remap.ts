import type { NodeObj } from 'mind-elixir';
import { readGate } from './gates.ts';
import type { Arrow, Summary } from './paste.ts';

function pair(pasted: NodeObj, inserted: NodeObj, out: Map<string, string>): void {
  out.set(pasted.id, inserted.id);
  const kids = inserted.children ?? [];
  (pasted.children ?? []).forEach((child, i) => { if (kids[i]) pair(child, kids[i], out); });
}

export function buildIdMap(pasted: readonly NodeObj[], inserted: readonly NodeObj[]): Map<string, string> {
  const out = new Map<string, string>();
  pasted.forEach((node, i) => { if (inserted[i]) pair(node, inserted[i], out); });
  return out;
}

function remapNodeGate(node: NodeObj, idMap: ReadonlyMap<string, string>): number {
  const gate = readGate(node);
  const next = gate ? idMap.get(gate.target) : undefined;
  let count = 0;
  if (next && node.metadata) {
    (node.metadata as { gate: { target: string } }).gate.target = next;
    count = 1;
  }
  return (node.children ?? []).reduce((sum, child) => sum + remapNodeGate(child, idMap), count);
}

export function remapGates(inserted: readonly NodeObj[], idMap: ReadonlyMap<string, string>): number {
  return inserted.reduce((sum, node) => sum + remapNodeGate(node, idMap), 0);
}

export function remapArrows(arrows: readonly Arrow[], idMap: ReadonlyMap<string, string>): Omit<Arrow, 'id'>[] {
  return arrows.flatMap(({ id: _id, ...arrow }) => {
    const from = idMap.get(arrow.from);
    const to = idMap.get(arrow.to);
    return from && to ? [{ ...arrow, from, to }] : [];
  });
}

export function remapSummaries(summaries: readonly Summary[], idMap: ReadonlyMap<string, string>): Omit<Summary, 'id'>[] {
  return summaries.flatMap(({ id: _id, ...summary }) => {
    const parent = idMap.get(summary.parent);
    return parent ? [{ ...summary, parent }] : [];
  });
}
