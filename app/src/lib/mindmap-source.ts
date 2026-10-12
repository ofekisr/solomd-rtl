import type { MindElixirData, NodeObj } from 'mind-elixir';
import { serializeMindmapFence } from './mindmap-fence.ts';

export interface MindmapSource { path?: string; line: number }

const NODE_LINE = /^\s*- /;
const NON_NODE_LINE = /^\s*- (?:\}|> )/;
const FENCE_BODY_OFFSET = 2;
const MIN_LINE = 1;
const UNSAFE_PATH = [/^[\\/]/, /\\/, /^[A-Za-z]:/, /^[a-z][\w+.-]*:/i, /\0/];
const DOT_SEGMENTS = new Set(['.', '..']);
const SEPARATOR = '/';
const BACKSLASH = /\\/g;
const MARKDOWN_EXTENSION = /\.(?:md|markdown)$/i;
const TRAILING_SLASHES = /\/+$/;

export function isSafeSourcePath(path: string): boolean {
  if (path === '' || UNSAFE_PATH.some((p) => p.test(path))) return false;
  return !path.split(SEPARATOR).some((segment) => DOT_SEGMENTS.has(segment));
}

export function isMarkdownSourcePath(path: string): boolean {
  return MARKDOWN_EXTENSION.test(path);
}

export function normalizeSeparators(path: string): string {
  return path.replace(BACKSLASH, SEPARATOR);
}

export function toWorkspaceRelative(absPath: string, root: string): string | undefined {
  const base = `${normalizeSeparators(root).replace(TRAILING_SLASHES, '')}${SEPARATOR}`;
  const path = normalizeSeparators(absPath);
  if (!path.startsWith(base)) return undefined;
  const rel = path.slice(base.length);
  return isSafeSourcePath(rel) ? rel : undefined;
}

export function resolveSourcePath(root: string, relPath: string): string {
  return `${root.replace(TRAILING_SLASHES, '')}${SEPARATOR}${relPath}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function readNodeSource(node: NodeObj): MindmapSource | null {
  const meta = node.metadata;
  const source = isRecord(meta) ? meta.source : undefined;
  if (!isRecord(source)) return null;
  const { line, path } = source;
  if (typeof line !== 'number' || !Number.isInteger(line) || line < MIN_LINE) return null;
  if (path !== undefined && typeof path !== 'string') return null;
  if (path !== undefined && !isSafeSourcePath(path)) return null;
  return path === undefined ? { line } : { path, line };
}

export function plaintextNodeLines(plaintext: string): number[] {
  return plaintext.split('\n').flatMap((line, i) => (NODE_LINE.test(line) && !NON_NODE_LINE.test(line) ? [i] : []));
}

export function preorderIds(root: NodeObj): string[] {
  return [root.id, ...(root.children ?? []).flatMap(preorderIds)];
}

export function fenceNodeSource(data: MindElixirData, nodeId: string, fenceLine: number): MindmapSource | null {
  const index = preorderIds(data.nodeData).indexOf(nodeId);
  const lines = plaintextNodeLines(serializeMindmapFence(data));
  if (index < 0 || index >= lines.length) return null;
  return { line: fenceLine + FENCE_BODY_OFFSET + lines[index] };
}
