import { markNode, readLegend, withLegend, type LegendEntry } from '../../../app/src/lib/mindmap/legend.ts';
import { requireNode, type MapDoc, type MapStore } from '../store.ts';
import { applyEdit } from './write.ts';

const NO_LEGEND = '(no legend yet)';

function legendText(doc: MapDoc): string {
  const names = readLegend(doc.data.nodeData).map((entry) => entry.meaning);
  return names.length > 0 ? names.join('\n') : NO_LEGEND;
}

export async function legend(store: MapStore, a: { file: string; set?: LegendEntry[] }): Promise<string> {
  if (!a.set) return legendText(await store.load(a.file));
  store.assertWritable();
  const doc = await store.load(a.file);
  const data = withLegend(doc.data, a.set);
  await store.save(a.file, { ...doc, data });
  return legendText({ ...doc, data });
}

export async function mark(store: MapStore, a: { file: string; node: string; meaning: string | null }): Promise<string> {
  store.assertWritable();
  const doc = await store.load(a.file);
  const node = requireNode(doc, a.node);
  await applyEdit(store, a.file, doc, markNode(doc.data, node.id, a.meaning));
  return a.meaning === null ? `Cleared mark on [^${node.id}]` : `Marked [^${node.id}] "${a.meaning.trim()}"`;
}
