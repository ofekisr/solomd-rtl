import type { MindElixirData } from 'mind-elixir';
import { isRecord } from './mindmap-gates.ts';
import { sanitizeMindmapData, sanitizeNodeObj } from './mindmap-format.ts';
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
const LAYOUT_KEYS: ReadonlySet<string> = new Set(['direction', 'expanded']);

export function entryKey(e: EntryDraft | WorkbenchEntry): string {
  if (e.kind === 'file') return `file${KEY_SEPARATOR}${e.path}`;
  return `nodes${KEY_SEPARATOR}${e.sourcePath}${KEY_SEPARATOR}${[...e.nodeIds].sort().join(ID_SEPARATOR)}`;
}

export function sanitizeSnapshot(data: MindElixirData): MindElixirData {
  return sanitizeMindmapData(data);
}

function sanitizeDraft(draft: EntryDraft): EntryDraft {
  if (draft.kind !== 'nodes') return draft;
  return { ...draft, snapshot: sanitizeSnapshot(draft.snapshot) };
}

export function upsertEntry(entries: readonly WorkbenchEntry[], rawDraft: EntryDraft, newId: string): { entries: WorkbenchEntry[]; status: 'added' | 'updated' } {
  const draft = sanitizeDraft(rawDraft);
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
  const snapshot = parseSnapshot(raw.snapshot);
  if (!snapshot) return null;
  return { ...base, kind: 'nodes', sourcePath: raw.sourcePath as string, nodeIds: raw.nodeIds as string[], snapshot, capturedAt: raw.capturedAt as string };
}

function parseSnapshot(raw: unknown): MindElixirData | null {
  if (!isRecord(raw)) return null;
  const nodeData = sanitizeNodeObj(raw.nodeData);
  if (!nodeData) return null;
  return sanitizeSnapshot({ ...raw, nodeData } as MindElixirData);
}

function safeParseEntry(raw: unknown): WorkbenchEntry | null {
  try {
    return parseEntry(raw);
  } catch {
    return null;
  }
}

export function parseWorkbench(raw: unknown): WorkbenchEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(safeParseEntry).filter((e): e is WorkbenchEntry => e !== null);
}

function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isRecord(value)) return value;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([k]) => !LAYOUT_KEYS.has(k))
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return Object.fromEntries(entries.map(([k, v]) => [k, sortKeys(v)]));
}

export function nodesStaleness(entry: NodesEntry, source: MindElixirData | null): Staleness {
  const current = source ? subtreeData(source, entry.nodeIds, entry.snapshot.nodeData.topic) : null;
  if (!current) return 'missing';
  return canonical(sanitizeSnapshot(current)) === canonical(sanitizeSnapshot(entry.snapshot)) ? 'fresh' : 'stale';
}

export function defaultMergeTopic(labels: readonly string[]): string {
  return labels.join(TOPIC_JOINER);
}
