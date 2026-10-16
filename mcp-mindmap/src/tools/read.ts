import type { NodeObj } from 'mind-elixir';
import { walkNodes } from '../../../app/src/lib/mindmap-gates.ts';
import { findDuplicateGroups, normalizeTopic } from '../../../app/src/lib/mindmap-duplicates.ts';
import { readFields } from '../../../app/src/lib/mindmap-node-fields.ts';
import { describeNode, outlineOf, pathOf, type NodeSummary } from '../../../app/src/lib/mindmap-address.ts';
import { requireNode, type MapStore } from '../store.ts';

export type FindBy = 'topic' | 'tag' | 'field' | 'note';
const NO_MATCH = '(no matches)';

export async function outline(store: MapStore, args: { file: string; node?: string; depth?: number }): Promise<string> {
  const doc = await store.load(args.file);
  const from = args.node ? requireNode(doc, args.node).id : undefined;
  return outlineOf(doc.data.nodeData, from, args.depth);
}

function haystack(node: NodeObj, by: FindBy): string[] {
  if (by === 'tag') return (node.tags ?? []).map(String);
  if (by === 'field') return readFields(node).flatMap((f) => [f.key, f.value]);
  if (by === 'note') return [node.note ?? ''];
  return [node.topic];
}

export async function find(store: MapStore, args: { file: string; query: string; by?: FindBy }): Promise<string> {
  const doc = await store.load(args.file);
  const needle = normalizeTopic(args.query);
  const hits = walkNodes(doc.data.nodeData).filter((n) => haystack(n, args.by ?? 'topic').some((h) => normalizeTopic(h).includes(needle)));
  return hits.map((n) => `[^${n.id}] ${pathOf(doc.data.nodeData, n.id)}`).join('\n') || NO_MATCH;
}

export async function node(store: MapStore, args: { file: string; node: string }): Promise<NodeSummary> {
  const doc = await store.load(args.file);
  return describeNode(doc.data.nodeData, requireNode(doc, args.node).id)!;
}

export async function duplicates(store: MapStore, args: { file: string }): Promise<string> {
  const doc = await store.load(args.file);
  const root = doc.data.nodeData;
  const groups = findDuplicateGroups(root);
  return groups.map((g) => g.ids.map((id) => `[^${id}] ${pathOf(root, id)}`).join('  ==  ')).join('\n') || NO_MATCH;
}
