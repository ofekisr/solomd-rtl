import { invoke } from '@tauri-apps/api/core';
import type { MindElixirData } from 'mind-elixir';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { useMindmapWorkbenchStore } from '../stores/mindmapWorkbench';
import { useFiles } from './useFiles';
import { useI18n } from '../i18n';
import type { FileReadResult } from '../types';
import { mergeMindmaps } from '../lib/mindmap-merge';
import { rootTopicFromFileName, sanitizeMindmapData, serializeMindmap } from '../lib/mindmap-format';
import { parseMapText, subtreeData } from '../lib/mindmap-payload';
import { nodesStaleness, TAB_SOURCE_PREFIX, type EntryDraft, type NodesEntry, type Staleness, type WorkbenchEntry } from '../lib/mindmap-workbench';

export const MINDMAP_WORKBENCH_EVENT = 'solomd:mindmap-workbench';
export const MINDMAP_WORKBENCH_ACTION = 'mindmap.workbench';
export interface WorkbenchOpenDetail { autoAdd?: EntryDraft }

const MINDMAP_LANGUAGE = 'mindmap';
const MMAP_SUFFIX = '.mmap';
const LABEL_SEPARATOR = ' › ';
const UNSAFE_FILE_CHARS = /[\\/:*?"<>|]+/gu;
const NAMES_JOINER = ', ';
const MIN_MAPS = 2;

export function openWorkbench(autoAdd?: EntryDraft): void {
  window.dispatchEvent(new CustomEvent<WorkbenchOpenDetail>(MINDMAP_WORKBENCH_EVENT, { detail: { autoAdd } }));
}

export function fileDraft(path: string): EntryDraft {
  return { kind: 'file', path, label: rootTopicFromFileName(path) };
}

export function nodesDraft(sourcePath: string, data: MindElixirData, nodeIds: string[], sourceLabel: string): EntryDraft | null {
  const snapshot = subtreeData(data, nodeIds, sourceLabel);
  if (!snapshot) return null;
  const label = `${sourceLabel}${LABEL_SEPARATOR}${snapshot.nodeData.topic}`;
  return { kind: 'nodes', sourcePath, nodeIds, label, snapshot, capturedAt: new Date().toISOString() };
}

export function useMindmapWorkbench() {
  const tabs = useTabsStore();
  const toasts = useToastsStore();
  const store = useMindmapWorkbenchStore();
  const { saveTabAs } = useFiles();
  const { t } = useI18n();

  async function readText(path: string): Promise<string | null> {
    const tab = path.startsWith(TAB_SOURCE_PREFIX)
      ? tabs.tabs.find((x) => x.id === path.slice(TAB_SOURCE_PREFIX.length))
      : tabs.tabs.find((x) => x.filePath === path);
    if (tab) return tab.content;
    if (path.startsWith(TAB_SOURCE_PREFIX)) return null;
    return invoke<FileReadResult>('read_file', { path }).then((r) => r.content, () => null);
  }

  async function readSource(path: string): Promise<MindElixirData | null> {
    const text = await readText(path);
    if (text === null) return null;
    const parsed = parseMapText(text, rootTopicFromFileName(path));
    return parsed.ok ? parsed.data : null;
  }

  const resolveEntry = (e: WorkbenchEntry): Promise<MindElixirData | null> =>
    e.kind === 'file' ? readSource(e.path) : Promise.resolve(e.snapshot);

  async function staleness(e: WorkbenchEntry): Promise<Staleness> {
    if (e.kind === 'file') return (await readSource(e.path)) ? 'fresh' : 'missing';
    return nodesStaleness(e, await readSource(e.sourcePath));
  }

  async function refreshEntry(e: NodesEntry): Promise<boolean> {
    const source = await readSource(e.sourcePath);
    const snapshot = source ? subtreeData(source, e.nodeIds, e.snapshot.nodeData.topic) : null;
    if (snapshot) store.replaceSnapshot(e.id, snapshot);
    return snapshot !== null;
  }

  async function mergeSelected(rootTopic: string): Promise<boolean> {
    const picked = store.selectedEntries;
    const resolved = await Promise.all(picked.map(resolveEntry));
    const missing = picked.filter((_, i) => resolved[i] === null).map((e) => e.label);
    const maps = resolved.filter((d): d is MindElixirData => d !== null);
    if (missing.length > 0) toasts.info(t('mindmap.workbenchSkipped', { names: missing.join(NAMES_JOINER) }));
    if (maps.length < MIN_MAPS) {
      toasts.info(t('mindmap.workbenchMergeNeedsTwo'));
      return false;
    }
    const merged = sanitizeMindmapData(mergeMindmaps(rootTopic, maps.map((data) => ({ data }))));
    const tab = tabs.newTab({ fileName: `${rootTopic.replace(UNSAFE_FILE_CHARS, '-')}${MMAP_SUFFIX}`, language: MINDMAP_LANGUAGE });
    tabs.setContent(tab.id, serializeMindmap(merged));
    const isSaved = await saveTabAs(tabs.tabs.find((x) => x.id === tab.id) ?? tab);
    if (!isSaved) tabs.closeTab(tab.id);
    return isSaved;
  }

  return { readSource, resolveEntry, staleness, refreshEntry, mergeSelected };
}
