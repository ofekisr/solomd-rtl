import type { MindElixirData } from 'mind-elixir';
import { convertToHtml, convertToMd } from '@mind-elixir/export-mindmap';
import { sanitizeMindmapData } from './mindmap-format.ts';

export type MindmapTextFormat = 'html' | 'json' | 'markdown';
export type MindmapImageFormat = 'png' | 'svg';
export type MindmapExportFormat = MindmapTextFormat | MindmapImageFormat;

export const MINDMAP_EXPORT_SPECS: Record<MindmapExportFormat, { extension: string; filterName: string }> = {
  png: { extension: 'png', filterName: 'PNG Image' },
  svg: { extension: 'svg', filterName: 'SVG Image' },
  html: { extension: 'html', filterName: 'HTML' },
  json: { extension: 'json', filterName: 'JSON' },
  markdown: { extension: 'md', filterName: 'Markdown' },
};

const IMAGE_FORMATS: ReadonlySet<MindmapExportFormat> = new Set<MindmapExportFormat>(['png', 'svg']);
const JSON_INDENT = 2;
const DATA_ASSIGNMENT = 'const data = ';
const HTML_MARKER_MISSING = 'export-mindmap HTML layout changed: data assignment not found';
const SCRIPT_UNSAFE_CHARS = /[<>&\u2028\u2029]/g;

export function isImageFormat(format: MindmapExportFormat): format is MindmapImageFormat {
  return IMAGE_FORMATS.has(format);
}

export function exportFileName(baseName: string, format: MindmapExportFormat): string {
  return `${baseName}.${MINDMAP_EXPORT_SPECS[format].extension}`;
}

export function escapeScriptJson(json: string): string {
  return json.replace(SCRIPT_UNSAFE_CHARS, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export function buildHtmlExport(data: MindElixirData): string {
  const safe = sanitizeMindmapData(data);
  const json = JSON.stringify(safe);
  const html = convertToHtml(safe);
  const marker = DATA_ASSIGNMENT + json;
  const at = html.indexOf(marker);
  if (at < 0) throw new Error(HTML_MARKER_MISSING);
  return html.slice(0, at) + DATA_ASSIGNMENT + escapeScriptJson(json) + html.slice(at + marker.length);
}

const TEXT_EXPORTERS: Record<MindmapTextFormat, (data: MindElixirData) => string> = {
  html: buildHtmlExport,
  json: (data) => JSON.stringify(sanitizeMindmapData(data), null, JSON_INDENT),
  markdown: (data) => convertToMd(sanitizeMindmapData(data).nodeData),
};

export function buildTextExport(data: MindElixirData, format: MindmapTextFormat): string {
  return TEXT_EXPORTERS[format](data);
}
