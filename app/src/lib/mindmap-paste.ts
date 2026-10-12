import type { MindElixirData, NodeObj } from 'mind-elixir';
import { parseMindmap, sanitizeMindmapData, sanitizeNodeObj } from './mindmap-format.ts';
import { MAX_MINDMAP_FENCE_CHARS, MINDMAP_FENCE_ROOT_TOPIC, parseMindmapFence } from './mindmap-fence.ts';
import { markdownToMindmap, SELECTION_ROOT_TOPIC } from './mindmap-convert.ts';

export type Arrow = NonNullable<MindElixirData['arrows']>[number];
export type Summary = NonNullable<MindElixirData['summaries']>[number];

export type PasteFormat = 'mmap' | 'json' | 'plaintext' | 'markdown' | 'outline' | 'line';
export interface PastePayload { format: PasteFormat; nodes: NodeObj[]; arrows: Arrow[]; summaries: Summary[] }
export type PasteResult = { ok: true; payload: PastePayload } | { ok: false; reason: 'empty' | 'tooLarge' | 'unrecognized' };

const PASTE_ROOT_TOPIC = '\u0000paste-root';
const SYNTHETIC_ROOTS: readonly string[] = [MINDMAP_FENCE_ROOT_TOPIC, SELECTION_ROOT_TOPIC, PASTE_ROOT_TOPIC];
const ENVELOPE_FORMAT = 'solomd-mindmap';
const JSON_START = /^[[{]/u;
const BULLET_LINE = /^\s*- /u;
const MARKDOWN_SIGNAL = /^(#{1,6}\s|\s*[*+]\s|\s*\d+[.)]\s)/mu;
const LEADING_WS = /^[\t ]*/u;
const TAB = '\t';
const BULLET_INDENT = '  ';
const BULLET = '- ';
const NEWLINE = '\n';
const LINE_SPLIT = /\r\n?|\n/u;
const LINE_NODE_ID = 'p1';

type Attempt = (text: string, lines: string[]) => PastePayload | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function payloadOf(format: PasteFormat, data: MindElixirData): PastePayload {
  const { nodeData: root, arrows, summaries } = sanitizeMindmapData(data);
  const nodes = SYNTHETIC_ROOTS.includes(root.topic) ? root.children ?? [] : [root];
  return { format, nodes, arrows: arrows ?? [], summaries: summaries ?? [] };
}

function nodesPayload(nodes: NodeObj[]): PastePayload {
  return { format: 'json', nodes, arrows: [], summaries: [] };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const tryEnvelope: Attempt = (text) => {
  const json = parseJson(text);
  if (!isRecord(json) || json.format !== ENVELOPE_FORMAT) return null;
  const parsed = parseMindmap(text, PASTE_ROOT_TOPIC);
  return parsed.ok ? payloadOf('mmap', parsed.data) : null;
};

function nodeArray(json: unknown[]): NodeObj[] | null {
  const nodes = json.map(sanitizeNodeObj);
  return nodes.length > 0 && nodes.every((n): n is NodeObj => n !== null) ? nodes : null;
}

const tryJson: Attempt = (text) => {
  const json = parseJson(text);
  if (Array.isArray(json)) {
    const nodes = nodeArray(json);
    return nodes ? nodesPayload(nodes) : null;
  }
  if (!isRecord(json)) return null;
  if (sanitizeNodeObj(json.nodeData)) return payloadOf('json', json as unknown as MindElixirData);
  const node = sanitizeNodeObj(json);
  return node ? nodesPayload([node]) : null;
};

function fromPlaintext(format: PasteFormat, text: string): PastePayload | null {
  const parsed = parseMindmapFence(text);
  return parsed.ok && !parsed.isEmpty ? payloadOf(format, parsed.data) : null;
}

const tryPlaintext: Attempt = (text, lines) => (lines.every((l) => BULLET_LINE.test(l)) ? fromPlaintext('plaintext', text) : null);

const tryMarkdown: Attempt = (text) => {
  if (!MARKDOWN_SIGNAL.test(text)) return null;
  const data = markdownToMindmap(text, { rootTopic: PASTE_ROOT_TOPIC });
  return (data.nodeData.children ?? []).length > 0 ? payloadOf('markdown', data) : null;
};

const tryOutline: Attempt = (_text, lines) => (lines.length >= 2 ? fromPlaintext('outline', outlineToPlaintext(lines)) : null);

const tryLine: Attempt = (_text, lines) => {
  if (lines.length !== 1) return null;
  const node = sanitizeNodeObj({ id: LINE_NODE_ID, topic: lines[0].trim() });
  return node ? { format: 'line', nodes: [node], arrows: [], summaries: [] } : null;
};

const JSON_ATTEMPTS: readonly Attempt[] = [tryEnvelope, tryJson];
const TEXT_ATTEMPTS: readonly Attempt[] = [tryPlaintext, tryMarkdown, tryOutline, tryLine];

function indentWidth(line: string): number {
  const ws = LEADING_WS.exec(line)?.[0] ?? '';
  return ws.includes(TAB) ? ws.split(TAB).length - 1 : ws.length;
}

export function outlineToPlaintext(lines: readonly string[]): string {
  const widths = lines.map(indentWidth);
  const unit = Math.min(...widths.filter((w) => w > 0), Number.POSITIVE_INFINITY);
  const base = Math.min(...widths);
  return lines
    .map((line, i) => `${BULLET_INDENT.repeat(Number.isFinite(unit) ? Math.round((widths[i] - base) / unit) : 0)}${BULLET}${line.trim()}`)
    .join(NEWLINE);
}

export function parsePaste(text: string): PasteResult {
  if (text.length > MAX_MINDMAP_FENCE_CHARS) return { ok: false, reason: 'tooLarge' };
  const lines = text.split(LINE_SPLIT).filter((l) => l.trim() !== '');
  if (lines.length === 0) return { ok: false, reason: 'empty' };
  const attempts = JSON_START.test(text.trimStart()) ? [...JSON_ATTEMPTS, ...TEXT_ATTEMPTS] : TEXT_ATTEMPTS;
  for (const attempt of attempts) {
    const payload = attempt(text, lines);
    if (payload && payload.nodes.length > 0) return { ok: true, payload };
  }
  return { ok: false, reason: 'unrecognized' };
}
