import type { MindElixirData, NodeObj } from 'mind-elixir';
import { serializeMindmapFence } from './mindmap-fence.ts';

export interface MindmapSource { path?: string; line: number }

const NODE_LINE = /^\s*- /;
const NON_NODE_LINE = /^\s*- (?:\}|> )/;
const FENCE_BODY_OFFSET = 2;
const MIN_LINE = 1;

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
