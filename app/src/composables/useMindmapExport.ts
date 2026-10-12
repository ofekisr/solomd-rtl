import { invoke } from '@tauri-apps/api/core';
import type { MindElixirInstance } from 'mind-elixir';
import { useExport } from './useExport';
import { useToastsStore } from '../stores/toasts';
import { useI18n } from '../i18n';
import { buildTextExport, exportFileName, MINDMAP_EXPORT_SPECS, type MindmapExportFormat } from '../lib/mindmap-export';
import { buildPngExport, buildSvgExport } from '../lib/mindmap-export-image';

type ExportPayload = { kind: 'text'; content: string } | { kind: 'binary'; bytes: Uint8Array };
const TEXT_ENCODING = 'UTF-8';

async function buildPayload(mind: MindElixirInstance, format: MindmapExportFormat): Promise<ExportPayload> {
  if (format === 'png') return { kind: 'binary', bytes: await buildPngExport(mind) };
  if (format === 'svg') return { kind: 'text', content: await buildSvgExport(mind) };
  return { kind: 'text', content: buildTextExport(mind.getData(), format) };
}

async function writePayload(path: string, payload: ExportPayload): Promise<void> {
  if (payload.kind === 'binary') {
    await invoke('write_binary_file', { path, data: Array.from(payload.bytes) });
    return;
  }
  await invoke('write_file', { path, content: payload.content, encoding: TEXT_ENCODING });
}

export function useMindmapExport() {
  const { pickWritePath } = useExport();
  const toasts = useToastsStore();
  const { t } = useI18n();

  async function exportMap(mind: MindElixirInstance, format: MindmapExportFormat, baseName: string): Promise<void> {
    const spec = MINDMAP_EXPORT_SPECS[format];
    const path = await pickWritePath(exportFileName(baseName, format), [{ name: spec.filterName, extensions: [spec.extension] }]);
    if (!path) return;
    try {
      await writePayload(path, await buildPayload(mind, format));
      toasts.success(t('mindmap.exportDone'));
    } catch (err) {
      toasts.error(`${t('mindmap.exportFailed')}: ${String(err)}`);
    }
  }

  return { exportMap };
}
