import { access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createEmptyMindmap, rootTopicFromFileName, sanitizeMindmapData } from '../../../app/src/lib/mindmap-format.ts';
import { markdownToMindmap } from '../../../app/src/lib/mindmap-convert.ts';
import { parsePaste } from '../../../app/src/lib/mindmap-paste.ts';
import { mergeMindmaps } from '../../../app/src/lib/mindmap-merge.ts';
import { graftMap } from '../../../app/src/lib/mindmap-payload.ts';
import { insertNodes } from '../../../app/src/lib/mindmap-edit.ts';
import { buildTextExport } from '../../../app/src/lib/mindmap-export.ts';
import { mapToHeadingsMarkdown } from '../../../app/src/lib/mindmap-headings.ts';
import { outlineOf, pathOf } from '../../../app/src/lib/mindmap-address.ts';
import { requireNode, type MapStore } from '../store.ts';

export type ExportFormat = 'outline' | 'markdown' | 'headings' | 'mermaid' | 'adjacency';
export type Opener = (args: string[]) => Promise<void>;

const MIN_MERGE = 2;
const TOPIC_JOINER = ' + ';
const APP_NAME = 'SoloMD';
const DEEP_LINK = 'solomd://open';
const run = promisify(execFile);
const macOpener: Opener = async (args) => { await run('open', args); };

async function exists(abs: string): Promise<boolean> {
  return access(abs).then(() => true, () => false);
}

function fromOutline(root: string, source: string) {
  const parsed = parsePaste(source);
  if (!parsed.ok) throw new Error(`Could not read the outline (${parsed.reason})`);
  const empty = createEmptyMindmap(root);
  const res = insertNodes(empty, empty.nodeData.id, parsed.payload.nodes);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export async function create(store: MapStore, a: { file: string; from: 'outline' | 'markdown'; source: string; root?: string }): Promise<string> {
  store.assertWritable();
  const abs = store.resolve(a.file);
  if (await exists(abs)) throw new Error(`${a.file} already exists. Edit it with mmap_add instead`);
  const root = a.root ?? rootTopicFromFileName(abs);
  const data = a.from === 'markdown' ? markdownToMindmap(a.source, { rootTopic: root }) : fromOutline(root, a.source);
  await store.save(a.file, { data, display: {}, snippets: [] });
  return `Created ${a.file}`;
}

export async function merge(store: MapStore, a: { files: string[]; out: string; root?: string }): Promise<string> {
  store.assertWritable();
  if (a.files.length < MIN_MERGE) throw new Error(`Give at least ${MIN_MERGE} files to merge`);
  if (await exists(store.resolve(a.out))) throw new Error(`${a.out} already exists. Pick another name`);
  const docs = await Promise.all(a.files.map((f) => store.load(f)));
  const root = a.root ?? docs.map((d) => d.data.nodeData.topic).join(TOPIC_JOINER);
  const data = sanitizeMindmapData(mergeMindmaps(root, docs.map((d) => ({ data: d.data }))));
  await store.save(a.out, { data, display: {}, snippets: [] });
  return `Created ${a.out} from ${a.files.length} maps`;
}

export async function graft(store: MapStore, a: { file: string; source: string; node?: string }): Promise<string> {
  store.assertWritable();
  const [target, source] = await Promise.all([store.load(a.file), store.load(a.source)]);
  const parentId = a.node ? requireNode(target, a.node).id : undefined;
  const res = graftMap(target.data, source.data, parentId);
  if (!res.ok) throw new Error(res.error);
  await store.save(a.file, { ...target, data: res.data });
  return `Grafted ${a.source} into ${a.file} as node ${res.rootId}`;
}

export async function exportMap(store: MapStore, a: { file: string; format: ExportFormat }): Promise<string> {
  const doc = await store.load(a.file);
  if (a.format === 'outline') return outlineOf(doc.data.nodeData);
  if (a.format === 'headings') return mapToHeadingsMarkdown(doc.data);
  return buildTextExport(doc.data, a.format, doc.snippets);
}

export function revealUrl(abs: string, nodeId?: string): string {
  const params = new URLSearchParams({ path: abs, ...(nodeId ? { node: nodeId } : {}) });
  return `${DEEP_LINK}?${params.toString()}`;
}

export async function reveal(store: MapStore, a: { file: string; node?: string }, opener: Opener = macOpener): Promise<string> {
  const abs = store.resolve(a.file);
  const doc = await store.load(a.file);
  const node = a.node ? requireNode(doc, a.node) : undefined;
  await opener(['-a', APP_NAME, abs]);
  const focus = node ? `. Node focus is not supported yet; the node is [^${node.id}] ${pathOf(doc.data.nodeData, node.id)}` : '';
  return `Opened ${a.file} in ${APP_NAME}${focus}`;
}
