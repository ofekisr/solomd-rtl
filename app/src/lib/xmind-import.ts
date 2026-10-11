import { convertXmindToMindElixir, importXMindFile } from '@mind-elixir/import-xmind';
import type { MindElixirData, NodeObj } from 'mind-elixir';
import { parseMindmap, sanitizeMindmapData, serializeMindmap } from './mindmap-format.ts';

export type XmindImportResult =
  | { ok: true; text: string; extraSheetCount: number }
  | { ok: false; error: string };

type XmindSheet = Parameters<typeof convertXmindToMindElixir>[0];

const NO_SHEETS_ERROR = 'XMind file has no sheets';
const EMPTY_TOPIC = '';

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
  const sheets: unknown = await importXMindFile(new File([bytes], fileName));
  if (!Array.isArray(sheets) || sheets.length === 0) throw new Error(NO_SHEETS_ERROR);
  return sheets as XmindSheet[];
}

export async function convertXmind(bytes: Uint8Array, fileName: string): Promise<XmindImportResult> {
  try {
    const sheets = await readSheets(bytes, fileName);
    const result = toMindmapText(convertXmindToMindElixir(sheets[0]));
    return result.ok ? { ...result, extraSheetCount: sheets.length - 1 } : result;
  } catch (err) {
    return failure(err instanceof Error ? err.message : String(err));
  }
}
