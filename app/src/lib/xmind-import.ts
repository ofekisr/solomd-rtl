import { convertXmindToMindElixir, importXMindFile } from '@mind-elixir/import-xmind';
import type { MindElixirData, NodeObj } from 'mind-elixir';
import JSZip from 'jszip';
import {
  MAX_XMIND_BYTES,
  MAX_XMIND_CONTENT_BYTES,
  XMIND_CONTENT_TOO_LARGE_ERROR,
  XMIND_TOO_LARGE_ERROR,
} from './xmind-limits.ts';
import { parseMindmap, sanitizeMindmapData, serializeMindmap } from './mindmap/format.ts';

export type XmindImportResult =
  | { ok: true; text: string; extraSheetCount: number }
  | { ok: false; error: string };

type XmindSheet = Parameters<typeof convertXmindToMindElixir>[0];

const NO_SHEETS_ERROR = 'XMind file has no sheets';
const EMPTY_TOPIC = '';
const CONTENT_ENTRY_NAMES = ['content.json', 'content.xml'];

function failure(error: string): XmindImportResult {
  return { ok: false, error };
}

function withStringTopics(node: NodeObj): NodeObj {
  return {
    ...node,
    topic: typeof node.topic === 'string' ? node.topic : EMPTY_TOPIC,
    ...(Array.isArray(node.children) ? { children: node.children.map(withStringTopics) } : {}),
  };
}

function toMindmapText(data: MindElixirData): XmindImportResult {
  const clean = sanitizeMindmapData({ ...data, nodeData: withStringTopics(data.nodeData) });
  const text = serializeMindmap(clean);
  const check = parseMindmap(text, EMPTY_TOPIC);
  return check.ok ? { ok: true, text, extraSheetCount: 0 } : failure(check.error);
}

async function readSheets(bytes: Uint8Array, fileName: string): Promise<XmindSheet[]> {
  const sheets: unknown = await importXMindFile(new File([bytes.slice().buffer], fileName));
  if (!Array.isArray(sheets) || sheets.length === 0) throw new Error(NO_SHEETS_ERROR);
  return sheets as XmindSheet[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function declaredSizeOf(entry: unknown): number | undefined {
  if (!isRecord(entry) || !isRecord(entry._data)) return undefined;
  const size = entry._data.uncompressedSize;
  return typeof size === 'number' ? size : undefined;
}

async function hasOversizedContent(bytes: Uint8Array): Promise<boolean> {
  const zip = await JSZip.loadAsync(bytes);
  return CONTENT_ENTRY_NAMES.some((name) => (declaredSizeOf(zip.file(name)) ?? 0) > MAX_XMIND_CONTENT_BYTES);
}

export async function convertXmind(bytes: Uint8Array, fileName: string): Promise<XmindImportResult> {
  if (bytes.byteLength > MAX_XMIND_BYTES) return failure(XMIND_TOO_LARGE_ERROR);
  try {
    if (await hasOversizedContent(bytes)) return failure(XMIND_CONTENT_TOO_LARGE_ERROR);
    const sheets = await readSheets(bytes, fileName);
    const result = toMindmapText(convertXmindToMindElixir(sheets[0]));
    return result.ok ? { ...result, extraSheetCount: sheets.length - 1 } : result;
  } catch (err) {
    return failure(err instanceof Error ? err.message : String(err));
  }
}
