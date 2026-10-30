import { fsPort } from '../platform/index.ts';
import type { MindElixirInstance } from 'mind-elixir';
import { useExport } from './useExport';
import { useToastsStore } from '../stores/toasts';
import { useI18n } from '../i18n';
import { buildTextExport, exportFileName, MINDMAP_EXPORT_SPECS, type MindmapExportFormat } from '../lib/mindmap-export';
import type { Snippet } from '../lib/mindmap-snippets';
import { buildPngExport, buildSvgExport } from '../lib/mindmap-export-image';

type ExportPayload = { kind: 'text'; content: string } | { kind: 'binary'; bytes: Uint8Array };
const TEXT_ENCODING = 'UTF-8';

async function buildPayload(mind: MindElixirInstance, format: MindmapExportFormat, snippets: readonly Snippet[]): Promise<ExportPayload> {
  if (format === 'png') return { kind: 'binary', bytes: await buildPngExport(mind) };
  if (format === 'svg') return { kind: 'text', content: await buildSvgExport(mind) };
  return { kind: 'text', content: buildTextExport(mind.getData(), format, snippets) };
}

async function writePayload(path: string, payload: ExportPayload): Promise<void> {
  if (payload.kind === 'binary') {
    await fsPort.writeBinaryFile( { path, data: Array.from(payload.bytes) });
    return;
  }
  await fsPort.writeFile( { path, content: payload.content, encoding: TEXT_ENCODING });
}

export function useMindmapExport() {
  const { pickWritePath } = useExport();
  const toasts = useToastsStore();
  const { t } = useI18n();

  async function exportMap(mind: MindElixirInstance, format: MindmapExportFormat, baseName: string, snippets: readonly Snippet[] = []): Promise<void> {
    const spec = MINDMAP_EXPORT_SPECS[format];
    try {
      const path = await pickWritePath(exportFileName(baseName, format), [{ name: spec.filterName, extensions: [spec.filterExtension ?? spec.extension] }]);
      if (!path) return;
      await writePayload(path, await buildPayload(mind, format, snippets));
      toasts.success(t('mindmap.exportDone'));
    } catch (err) {
      toasts.error(`${t('mindmap.exportFailed')}: ${String(err)}`);
    }
  }

  return { exportMap };
}
