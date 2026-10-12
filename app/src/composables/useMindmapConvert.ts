import type { MindElixirData } from 'mind-elixir';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { useWorkspaceStore } from '../stores/workspace';
import { useI18n } from '../i18n';
import type { Tab } from '../types';
import { fileNameOf } from '../lib/import-plan';
import { buildMindmapFence, insertBlockAfterLine } from '../lib/mindmap-fence';
import { markdownToMindmap, sectionRange, sliceLines, SELECTION_ROOT_TOPIC, type LineRange } from '../lib/mindmap-convert';
import { mmapPathFor, rootTopicFromFileName, sanitizeMindmapData, serializeMindmap } from '../lib/mindmap-format';
import { toWorkspaceRelative } from '../lib/mindmap-source';

export type ConvertScope = 'document' | 'section' | 'selection';
export type ConvertOutput = 'map' | 'fence';
export const MINDMAP_CONVERT_EVENT = 'solomd:mindmap-convert';
const MARKDOWN_LANGUAGE = 'markdown';
const MINDMAP_LANGUAGE = 'mindmap';

export const MINDMAP_CONVERT_ACTIONS: Record<string, { scope: ConvertScope; output: ConvertOutput }> = {
  'mindmap.convertDocument': { scope: 'document', output: 'map' },
  'mindmap.convertSection': { scope: 'section', output: 'map' },
  'mindmap.convertSelection': { scope: 'selection', output: 'map' },
  'mindmap.insertFenceFromSection': { scope: 'section', output: 'fence' },
  'mindmap.insertFenceFromSelection': { scope: 'selection', output: 'fence' },
};
export const MINDMAP_CONVERT_ACTION_IDS = Object.keys(MINDMAP_CONVERT_ACTIONS);

export interface MindmapConvertDetail { scope: ConvertScope; output: ConvertOutput; paneId: string }
export interface LineSelection { fromLine: number; toLine: number; headLine: number; isEmpty: boolean }
type RangeResult = { range: LineRange } | { errorKey: string };

function resolveRange(content: string, scope: ConvertScope, selection: LineSelection | null): RangeResult {
  if (scope === 'document') return { range: { fromLine: 1, toLine: content.split('\n').length } };
  if (!selection) return { errorKey: 'mindmap.convertNeedsEditor' };
  if (scope === 'selection') {
    if (selection.isEmpty) return { errorKey: 'mindmap.convertEmptySelection' };
    return { range: { fromLine: selection.fromLine, toLine: selection.toLine } };
  }
  const range = sectionRange(content, selection.headLine);
  return range ? { range } : { errorKey: 'mindmap.convertNoSection' };
}

export function useMindmapConvert() {
  const tabs = useTabsStore();
  const toasts = useToastsStore();
  const workspace = useWorkspaceStore();
  const { t } = useI18n();

  function buildData(tab: Tab, scope: ConvertScope, range: LineRange): MindElixirData {
    const path = tab.filePath && workspace.currentFolder ? toWorkspaceRelative(tab.filePath, workspace.currentFolder) : undefined;
    const rootTopic = scope === 'selection' ? SELECTION_ROOT_TOPIC : rootTopicFromFileName(tab.fileName);
    const tree = markdownToMindmap(sliceLines(tab.content, range), { rootTopic, path, firstLine: range.fromLine });
    return sanitizeMindmapData(tree);
  }

  function openAsMap(tab: Tab, data: MindElixirData): void {
    const mapTab = tabs.newTab({ fileName: fileNameOf(mmapPathFor(tab.filePath ?? tab.fileName)), language: MINDMAP_LANGUAGE });
    tabs.setContent(mapTab.id, serializeMindmap(data));
  }

  function insertFence(tab: Tab, range: LineRange, data: MindElixirData): void {
    tabs.setContent(tab.id, insertBlockAfterLine(tab.content, range.toLine, buildMindmapFence(data)));
  }

  function convert(tab: Tab, scope: ConvertScope, output: ConvertOutput, selection: LineSelection | null): void {
    if (tab.language !== MARKDOWN_LANGUAGE) return void toasts.info(t('mindmap.convertMarkdownOnly'));
    const resolved = resolveRange(tab.content, scope, selection);
    if ('errorKey' in resolved) return void toasts.info(t(resolved.errorKey));
    const data = buildData(tab, scope, resolved.range);
    if (output === 'map') openAsMap(tab, data);
    else insertFence(tab, resolved.range, data);
    toasts.success(t('mindmap.convertDone'));
  }

  return { convert };
}
