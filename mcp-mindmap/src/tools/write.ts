import type { NodeObj } from 'mind-elixir';
import { parsePaste } from '../../../app/src/lib/mindmap-paste.ts';
import { insertNodes, moveNode, newNodeId, removeNode, updateNode, type EditResult } from '../../../app/src/lib/mindmap-edit.ts';
import { canBeGateTarget, makeGateNode } from '../../../app/src/lib/mindmap-gates.ts';
import { mergeIntoGate } from '../../../app/src/lib/mindmap-duplicates.ts';
import { fieldsPatch, notePatch, type NodeFieldEntry } from '../../../app/src/lib/mindmap-node-fields.ts';
import { requireNode, type MapDoc, type MapStore } from '../store.ts';

type GateArgs =
  | { file: string; action: 'link'; parent: string; target: string }
  | { file: string; action: 'unlink'; gate: string }
  | { file: string; action: 'merge'; keep: string; duplicate: string };

type EditArgs = { file: string; node: string; topic?: string; note?: string; tags?: string[]; fields?: NodeFieldEntry[] };

async function writable(store: MapStore, file: string): Promise<MapDoc> {
  store.assertWritable();
  return store.load(file);
}

export async function applyEdit(store: MapStore, file: string, doc: MapDoc, res: EditResult): Promise<string[]> {
  if (!res.ok) throw new Error(res.error);
  await store.save(file, { ...doc, data: res.data });
  return res.ids;
}

const idList = (ids: readonly string[]): string => ids.map((id) => `[^${id}]`).join(' ');

export async function add(store: MapStore, a: { file: string; parent: string; outline: string; index?: number }): Promise<string> {
  const doc = await writable(store, a.file);
  const parsed = parsePaste(a.outline);
  if (!parsed.ok) throw new Error(`Could not read the outline (${parsed.reason}). Use "- Topic" lines, two spaces per level`);
  const parent = requireNode(doc, a.parent);
  const ids = await applyEdit(store, a.file, doc, insertNodes(doc.data, parent.id, parsed.payload.nodes, a.index));
  return `Added ${ids.length} node(s) under [^${parent.id}]: ${idList(ids)}`;
}

function editPatch(node: NodeObj, a: EditArgs): Partial<NodeObj> {
  return {
    ...(a.topic !== undefined ? { topic: a.topic } : {}),
    ...(a.note !== undefined ? notePatch(a.note) : {}),
    ...(a.tags !== undefined ? { tags: a.tags.length > 0 ? a.tags : undefined } : {}),
    ...(a.fields !== undefined ? fieldsPatch(node, a.fields) : {}),
  };
}

export async function edit(store: MapStore, a: EditArgs): Promise<string> {
  const doc = await writable(store, a.file);
  const node = requireNode(doc, a.node);
  await applyEdit(store, a.file, doc, updateNode(doc.data, node.id, editPatch(node, a)));
  return `Updated [^${node.id}]`;
}

export async function move(store: MapStore, a: { file: string; node: string; parent: string; index?: number }): Promise<string> {
  const doc = await writable(store, a.file);
  const [node, parent] = [requireNode(doc, a.node), requireNode(doc, a.parent)];
  await applyEdit(store, a.file, doc, moveNode(doc.data, node.id, parent.id, a.index));
  return `Moved [^${node.id}] under [^${parent.id}]`;
}

export async function remove(store: MapStore, a: { file: string; node: string }): Promise<string> {
  const doc = await writable(store, a.file);
  const node = requireNode(doc, a.node);
  const res = removeNode(doc.data, node.id);
  await applyEdit(store, a.file, doc, res);
  const broken = res.ok ? res.brokenGates : 0;
  return `Removed [^${node.id}] "${node.topic}"${broken > 0 ? `; ${broken} gate now broken (find them with mmap_find query "⇒")` : ''}`;
}

async function link(store: MapStore, a: Extract<GateArgs, { action: 'link' }>): Promise<string> {
  const doc = await writable(store, a.file);
  const [parent, target] = [requireNode(doc, a.parent), requireNode(doc, a.target)];
  if (!canBeGateTarget(target)) throw new Error(`"${target.topic}" cannot be a gate target (it is itself a gate)`);
  const ids = await applyEdit(store, a.file, doc, insertNodes(doc.data, parent.id, [makeGateNode(newNodeId(), target)]));
  return `Gate ${idList(ids)} under [^${parent.id}] → [^${target.id}]`;
}

async function merge(store: MapStore, a: Extract<GateArgs, { action: 'merge' }>): Promise<string> {
  const doc = await writable(store, a.file);
  const [keep, dup] = [requireNode(doc, a.keep), requireNode(doc, a.duplicate)];
  const data = mergeIntoGate(doc.data, keep.id, dup.id);
  if (!data) throw new Error('These nodes cannot merge (one contains the other, or one is a gate)');
  await applyEdit(store, a.file, doc, { ok: true, data, ids: [dup.id] });
  return `Merged [^${dup.id}] into [^${keep.id}]; [^${dup.id}] is now a gate`;
}

export async function gate(store: MapStore, a: GateArgs): Promise<string> {
  if (a.action === 'link') return link(store, a);
  if (a.action === 'merge') return merge(store, a);
  return remove(store, { file: a.file, node: a.gate });
}
