import type { MindElixirData, NodeObj } from 'mind-elixir';
import { isRecord } from './gates.ts';

type Arrow = NonNullable<MindElixirData['arrows']>[number];
type Summary = NonNullable<MindElixirData['summaries']>[number];

export interface MergeEntry { data: MindElixirData; group?: string }

const FILE_PREFIX = 'f';
const GROUP_PREFIX = 'g';
const PREFIX_SEPARATOR = '-';
const PAD_WIDTH = 2;
const PAD_CHAR = '0';
const ROOT_ID = 'root';

const pad = (n: number): string => String(n).padStart(PAD_WIDTH, PAD_CHAR);

export function filePrefix(index: number): string {
  return `${FILE_PREFIX}${pad(index + 1)}${PREFIX_SEPARATOR}`;
}

function prefixGate(gate: unknown, prefix: string): unknown {
  if (!isRecord(gate) || typeof gate.target !== 'string' || gate.target === '') return gate;
  return { ...gate, target: `${prefix}${gate.target}` };
}

function prefixMetadata(metadata: unknown, prefix: string): unknown {
  if (!isRecord(metadata)) return metadata;
  const next: Record<string, unknown> = { ...metadata };
  if (typeof metadata.refId === 'string') next.refId = `${prefix}${metadata.refId}`;
  if ('gate' in metadata) next.gate = prefixGate(metadata.gate, prefix);
  return next;
}

function prefixNode(node: NodeObj, prefix: string): NodeObj {
  const next: NodeObj = { ...node, id: `${prefix}${node.id}` };
  if (node.metadata !== undefined) next.metadata = prefixMetadata(node.metadata, prefix);
  if (node.children) next.children = node.children.map((child) => prefixNode(child, prefix));
  return next;
}

const prefixArrow = (a: Arrow, prefix: string): Arrow => (
  { ...a, id: `${prefix}${a.id}`, from: `${prefix}${a.from}`, to: `${prefix}${a.to}` }
);

const prefixSummary = (s: Summary, prefix: string): Summary => (
  { ...s, id: `${prefix}${s.id}`, parent: `${prefix}${s.parent}` }
);

export function prefixMindmapIds(data: MindElixirData, prefix: string): MindElixirData {
  const next: MindElixirData = { ...data, nodeData: prefixNode(data.nodeData, prefix) };
  if (data.arrows) next.arrows = data.arrows.map((a) => prefixArrow(a, prefix));
  if (data.summaries) next.summaries = data.summaries.map((s) => prefixSummary(s, prefix));
  return next;
}

function groupChildren(entries: MergeEntry[], nodes: NodeObj[]): NodeObj[] {
  const out: NodeObj[] = [];
  let groupCount = 0;
  let openGroup: NodeObj | undefined;
  entries.forEach((entry, i) => {
    if (entry.group === undefined) {
      openGroup = undefined;
      out.push(nodes[i]);
      return;
    }
    const continuesGroup = openGroup !== undefined && entries[i - 1]?.group === entry.group;
    if (continuesGroup && openGroup?.children) {
      openGroup.children.push(nodes[i]);
      return;
    }
    groupCount += 1;
    openGroup = { id: `${GROUP_PREFIX}${pad(groupCount)}`, topic: entry.group, children: [nodes[i]] };
    out.push(openGroup);
  });
  return out;
}

export function mergeMindmaps(rootTopic: string, entries: MergeEntry[]): MindElixirData {
  const prefixed = entries.map((entry, i) => prefixMindmapIds(entry.data, filePrefix(i)));
  const arrows = prefixed.flatMap((d) => d.arrows ?? []);
  const summaries = prefixed.flatMap((d) => d.summaries ?? []);
  const children = groupChildren(entries, prefixed.map((d) => d.nodeData));
  const merged: MindElixirData = { nodeData: { id: ROOT_ID, topic: rootTopic, children } };
  if (arrows.length > 0) merged.arrows = arrows;
  if (summaries.length > 0) merged.summaries = summaries;
  return merged;
}
