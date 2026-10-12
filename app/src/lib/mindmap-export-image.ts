import DOMPurify from 'dompurify';
import type { Config } from 'dompurify';
import type { MindElixirInstance } from 'mind-elixir';
import { exportImageBlob } from '@mind-elixir/export-mindmap';

const XML_PROLOG = '<?xml version="1.0" encoding="UTF-8"?>\n';
const SVG_PURIFY_CONFIG: Config = {
  USE_PROFILES: { svg: true, svgFilters: true, html: true },
  ADD_TAGS: ['foreignObject'],
  HTML_INTEGRATION_POINTS: { foreignobject: true },
};

export async function buildPngExport(mind: MindElixirInstance): Promise<Uint8Array> {
  const blob = await exportImageBlob(mind, 'png', { watermarkEnabled: false });
  return new Uint8Array(await blob.arrayBuffer());
}

export async function buildSvgExport(mind: MindElixirInstance): Promise<string> {
  const raw = await mind.exportSvg().text();
  return XML_PROLOG + String(DOMPurify.sanitize(raw, SVG_PURIFY_CONFIG));
}
