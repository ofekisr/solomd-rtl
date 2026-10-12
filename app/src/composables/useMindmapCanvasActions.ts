import type { Ref } from 'vue';
import type { MindElixirInstance } from 'mind-elixir';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useMindmapExport } from './useMindmapExport';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { useI18n } from '../i18n';
import type { MindmapExportFormat } from '../lib/mindmap-export';
import { mapToHeadingsMarkdown } from '../lib/mindmap-headings';
import { serializeMindmapFence } from '../lib/mindmap-fence';
import { withoutGateArrows } from '../lib/mindmap-graph';

export interface CanvasActionContext {
  getMind(): MindElixirInstance | null;
  exportName(): string;
  isReadOnly: Ref<boolean>;
  isGraphView: Ref<boolean>;
}

const HEADINGS_SUFFIX = '-outline.md';
const EXPORT_ACTIONS: Record<string, MindmapExportFormat> = {
  'mindmap.exportPng': 'png',
  'mindmap.exportSvg': 'svg',
  'mindmap.exportHtml': 'html',
  'mindmap.exportJson': 'json',
  'mindmap.exportMarkdown': 'markdown',
  'mindmap.exportMermaid': 'mermaid',
  'mindmap.exportAdjacency': 'adjacency',
};

export function useMindmapCanvasActions(ctx: CanvasActionContext): Record<string, () => void> {
  const { exportMap } = useMindmapExport();
  const tabs = useTabsStore();
  const toasts = useToastsStore();
  const { t } = useI18n();

  const exportAs = (format: MindmapExportFormat) => () => {
    const mind = ctx.getMind();
    if (mind) void exportMap(mind, format, ctx.exportName());
  };

  async function copyPlaintext(): Promise<void> {
    const mind = ctx.getMind();
    if (!mind) return;
    await writeText(serializeMindmapFence(withoutGateArrows(mind.getData())));
    toasts.success(t('mindmap.copiedPlaintext'));
  }

  function openHeadingsDocument(): void {
    const mind = ctx.getMind();
    if (!mind) return;
    const tab = tabs.newTab({ fileName: ctx.exportName() + HEADINGS_SUFFIX });
    tabs.setContent(tab.id, mapToHeadingsMarkdown(withoutGateArrows(mind.getData())));
  }

  function toggleReadOnly(): void {
    const mind = ctx.getMind();
    if (!mind) return;
    ctx.isReadOnly.value = !ctx.isReadOnly.value;
    if (ctx.isReadOnly.value) mind.disableEdit();
    else if (!ctx.isGraphView.value) mind.enableEdit();
  }

  const exports = Object.fromEntries(Object.entries(EXPORT_ACTIONS).map(([id, format]) => [id, exportAs(format)]));
  return {
    ...exports,
    'mindmap.copyPlaintext': () => { void copyPlaintext().catch((e: unknown) => toasts.error(String(e))); },
    'mindmap.toHeadingsDocument': openHeadingsDocument,
    'mindmap.toggleReadOnly': toggleReadOnly,
  };
}
