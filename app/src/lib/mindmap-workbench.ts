import type { MindElixirData } from 'mind-elixir';
import { isRecord } from './mindmap-gates.ts';
import { sanitizeMindmapData } from './mindmap-format.ts';
import { subtreeData } from './mindmap-payload.ts';

export interface FileEntry { id: string; kind: 'file'; path: string; label: string; selected: boolean }
export interface NodesEntry { id: string; kind: 'nodes'; sourcePath: string; nodeIds: string[]; label: string; snapshot: MindElixirData; capturedAt: string; selected: boolean }
export type WorkbenchEntry = FileEntry | NodesEntry;
export type EntryDraft = Omit<FileEntry, 'id' | 'selected'> | Omit<NodesEntry, 'id' | 'selected'>;
export type Staleness = 'fresh' | 'stale' | 'missing';

export const TAB_SOURCE_PREFIX = 'tab:';
const KEY_SEPARATOR = '#';
const ID_SEPARATOR = ',';
const TOPIC_JOINER = ' + ';

export function entryKey(e: EntryDraft | WorkbenchEntry): string {
  if (e.kind === 'file') return `file${KEY_SEPARATOR}${e.path}`;
  return `nodes${KEY_SEPARATOR}${e.sourcePath}${KEY_SEPARATOR}${[...e.nodeIds].sort().join(ID_SEPARATOR)}`;
}

export function upsertEntry(entries: readonly WorkbenchEntry[], draft: EntryDraft, newId: string): { entries: WorkbenchEntry[]; status: 'added' | 'updated' } {
  const key = entryKey(draft);
  const index = entries.findIndex((e) => entryKey(e) === key);
  if (index < 0) return { entries: [...entries, { ...draft, id: newId, selected: true } as WorkbenchEntry], status: 'added' };
  const current = entries[index];
  const next = [...entries];
  next[index] = { ...draft, id: current.id, selected: current.selected } as WorkbenchEntry;
  return { entries: next, status: 'updated' };
}

export function removeEntries(entries: readonly WorkbenchEntry[], ids: ReadonlySet<string>): WorkbenchEntry[] {
  return entries.filter((e) => !ids.has(e.id));
}

const isString = (v: unknown): v is string => typeof v === 'string';

function parseEntry(raw: unknown): WorkbenchEntry | null {
  if (!isRecord(raw) || !isString(raw.id) || !isString(raw.label) || typeof raw.selected !== 'boolean') return null;
  const base = { id: raw.id, label: raw.label, selected: raw.selected };
  if (raw.kind === 'file' && isString(raw.path)) return { ...base, kind: 'file', path: raw.path };
  const isNodes = raw.kind === 'nodes' && isString(raw.sourcePath) && isString(raw.capturedAt)
    && Array.isArray(raw.nodeIds) && raw.nodeIds.every(isString) && isRecord(raw.snapshot) && isRecord(raw.snapshot.nodeData);
  if (!isNodes) return null;
  const snapshot = sanitizeMindmapData(raw.snapshot as unknown as MindElixirData);
  return { ...base, kind: 'nodes', sourcePath: raw.sourcePath as string, nodeIds: raw.nodeIds as string[], snapshot, capturedAt: raw.capturedAt as string };
}

export function parseWorkbench(raw: unknown): WorkbenchEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseEntry).filter((e): e is WorkbenchEntry => e !== null);
}

export function nodesStaleness(entry: NodesEntry, source: MindElixirData | null): Staleness {
  const current = source ? subtreeData(source, entry.nodeIds, entry.snapshot.nodeData.topic) : null;
  if (!current) return 'missing';
  return JSON.stringify(current) === JSON.stringify(entry.snapshot) ? 'fresh' : 'stale';
}

export function defaultMergeTopic(labels: readonly string[]): string {
  return labels.join(TOPIC_JOINER);
}
