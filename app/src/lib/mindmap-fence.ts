import type { MindElixirData } from 'mind-elixir';
import { mindElixirToPlaintext, plaintextToMindElixir } from 'mind-elixir/plaintextConverter';
import { fenceRanges } from './mindmap-md-scan.ts';
import { scanFencedBlocks, type FencedBlock } from './fence-scan.ts';
import { attachGatesFromTopics, gatesToTopics } from './mindmap-gate-plaintext.ts';
import { createEmptyMindmap, sanitizeMindmapData, type MindmapCodec, type MindmapParseResult } from './mindmap-format.ts';

export const MINDMAP_FENCE_LANG = 'mindmap';
export const MINDMAP_FENCE_ROOT_TOPIC = 'Mind Map';
export const MAX_MINDMAP_FENCE_CHARS = 200_000;
export const MINDMAP_OPEN_EVENT = 'solomd:mindmap-open';
const NEWLINE = '\n';
const CRLF_PATTERN = /\r\n?/g;

export interface MindmapFenceTarget { line: number; body: string }
export interface MindmapOpenDetail extends MindmapFenceTarget { tabId: string }
export type MindmapFence = FencedBlock;
export type FenceReplaceResult = { ok: true; source: string; line: number } | { ok: false };

export function isMindmapFenceInfo(info: string): boolean {
  const [language = ''] = info.trim().split(/\s+/u);
  return language.toLowerCase() === MINDMAP_FENCE_LANG;
}

export function findMindmapFences(source: string): MindmapFence[] {
  return scanFencedBlocks(source).filter((block) => isMindmapFenceInfo(block.info));
}

export function normalizeFenceBody(body: string): string {
  return body.replace(CRLF_PATTERN, NEWLINE).split(NEWLINE).map((l) => l.trimEnd()).join(NEWLINE).trimEnd();
}

export function parseMindmapFence(body: string): MindmapParseResult {
  if (body.length > MAX_MINDMAP_FENCE_CHARS) return { ok: false, error: `Mindmap fence exceeds ${MAX_MINDMAP_FENCE_CHARS} characters` };
  const text = normalizeFenceBody(body);
  if (text === '') return { ok: true, data: createEmptyMindmap(MINDMAP_FENCE_ROOT_TOPIC), isEmpty: true, display: {}, snippets: [] };
  try {
    return { ok: true, data: attachGatesFromTopics(sanitizeMindmapData(plaintextToMindElixir(text, MINDMAP_FENCE_ROOT_TOPIC))), isEmpty: false, display: {}, snippets: [] };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function serializeMindmapFence(data: MindElixirData): string {
  return normalizeFenceBody(mindElixirToPlaintext(gatesToTopics(sanitizeMindmapData(data))));
}

const FENCE_MARKER = '```';
const BLANK_LINE_PATTERN = /^\s*$/;

export function buildMindmapFence(data: MindElixirData): string {
  return [FENCE_MARKER + MINDMAP_FENCE_LANG, serializeMindmapFence(data), FENCE_MARKER].join(NEWLINE);
}

export function safeInsertLine(source: string, line: number): number {
  const open = fenceRanges(source).find((range) => line >= range.from && line < range.to);
  return open ? open.to : line;
}

export function insertBlockAfterLine(source: string, line: number, block: string): string {
  const lines = source.split(NEWLINE);
  const head = lines.slice(0, line);
  const tail = lines.slice(line);
  while (head.length > 0 && BLANK_LINE_PATTERN.test(head[head.length - 1])) head.pop();
  while (tail.length > 0 && BLANK_LINE_PATTERN.test(tail[0])) tail.shift();
  const tailText = tail.join(NEWLINE);
  return head.join(NEWLINE) + NEWLINE + NEWLINE + block + NEWLINE + (tailText ? NEWLINE + tailText : '');
}

export const mindmapFenceCodec: MindmapCodec = { parse: parseMindmapFence, serialize: serializeMindmapFence };

function locate(fences: MindmapFence[], target: MindmapFenceTarget): MindmapFence | null {
  const wanted = normalizeFenceBody(target.body);
  const matches = fences.filter((f) => normalizeFenceBody(f.body) === wanted);
  const atLine = matches.find((f) => f.line === target.line);
  if (atLine) return atLine;
  return matches.length === 1 ? matches[0] : null;
}

function indentBody(body: string, indent: string): string {
  return body.split(NEWLINE).map((line) => (line === '' ? line : indent + line)).join(NEWLINE);
}

export function replaceMindmapFence(source: string, target: MindmapFenceTarget, nextBody: string): FenceReplaceResult {
  const fence = locate(findMindmapFences(source), target);
  if (!fence) return { ok: false };
  const text = indentBody(normalizeFenceBody(nextBody), fence.indent);
  const replacement = text === '' ? '' : text + NEWLINE;
  return { ok: true, source: source.slice(0, fence.bodyFrom) + replacement + source.slice(fence.bodyTo), line: fence.line };
}
