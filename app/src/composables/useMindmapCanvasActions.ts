import type { Ref } from 'vue';
import type { MindElixirInstance } from 'mind-elixir';
import { clipboardPort } from '../platform/index.ts';
import { useMindmapExport } from './useMindmapExport';
import { useToastsStore } from '../stores/toasts';
import { useI18n } from '../i18n';
import type { MindmapExportFormat } from '../lib/mindmap-export';
import { mapToHeadingsMarkdown } from '../lib/mindmap-headings';
import { snippetsMarkdown, type Snippet } from '../lib/mindmap-snippets';
import { serializeMindmapFence } from '../lib/mindmap-fence';
import { withoutGateArrows } from '../lib/mindmap-graph';
import { siblingPath } from '../lib/convert-conflict';
import { fileNameOf } from '../lib/import-plan';
import { useConvertedOutput } from './useConvertedOutput';

export interface CanvasActionContext {
  getMind(): MindElixirInstance | null;
  exportName(): string;
  isReadOnly: Ref<boolean>;
  isLocked(): boolean;
  getSnippets(): readonly Snippet[];
  sourceFilePath(): string | null;
}

const HEADINGS_SUFFIX = '-outline.md';
const SECTION_JOINER = '\n';
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
  const { openConvertedContent } = useConvertedOutput();
  const toasts = useToastsStore();
  const { t } = useI18n();

  const exportAs = (format: MindmapExportFormat) => () => {
    const mind = ctx.getMind();
    if (mind) void exportMap(mind, format, ctx.exportName(), ctx.getSnippets());
  };

  async function copyPlaintext(): Promise<void> {
    const mind = ctx.getMind();
    if (!mind) return;
    await clipboardPort.writeText(serializeMindmapFence(withoutGateArrows(mind.getData())));
    toasts.success(t('mindmap.copiedPlaintext'));
  }

  function openHeadingsDocument(): void {
    const mind = ctx.getMind();
    if (!mind) return;
    const markdown = mapToHeadingsMarkdown(withoutGateArrows(mind.getData()));
    const snippets = snippetsMarkdown(ctx.getSnippets(), 'source');
    const fileName = ctx.exportName() + HEADINGS_SUFFIX;
    const source = ctx.sourceFilePath();
    void openConvertedContent({
      sourceName: source ? fileNameOf(source) : fileName,
      targetPath: source ? siblingPath(source, fileName) : null,
      fileName,
      language: 'markdown',
      content: snippets === '' ? markdown : markdown + SECTION_JOINER + snippets,
    });
  }

  function toggleReadOnly(): void {
    const mind = ctx.getMind();
    if (!mind) return;
    ctx.isReadOnly.value = !ctx.isReadOnly.value;
    if (ctx.isReadOnly.value) mind.disableEdit();
    else if (!ctx.isLocked()) mind.enableEdit();
  }

  const exports = Object.fromEntries(Object.entries(EXPORT_ACTIONS).map(([id, format]) => [id, exportAs(format)]));
  return {
    ...exports,
    'mindmap.copyPlaintext': () => { void copyPlaintext().catch((e: unknown) => toasts.error(String(e))); },
    'mindmap.toHeadingsDocument': openHeadingsDocument,
    'mindmap.toggleReadOnly': toggleReadOnly,
  };
}
