import type { MindElixirData, NodeObj } from 'mind-elixir';

export const MMAP_EXTENSION = 'mmap';
export const MINDMAP_EXTENSIONS: readonly string[] = [MMAP_EXTENSION];

const FORMAT_ID = 'solomd-mindmap';
const FORMAT_VERSION = 1;
const JSON_INDENT = 2;
const ROOT_ID = 'root';
const DEFAULT_ROOT_TOPIC = 'Untitled';
const SAFE_LINK_PATTERN = /^(https?:|mailto:)/i;
const ANGLE_BRACKET_PATTERN = /[<>]/g;

interface MindmapEnvelope {
  format: typeof FORMAT_ID;
  version: typeof FORMAT_VERSION;
  data: MindElixirData;
}

export type MindmapParseResult =
  | { ok: true; data: MindElixirData; isEmpty: boolean }
  | { ok: false; error: string };

function extensionOf(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? '';
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase();
}

export function isMindmapPath(path: string): boolean {
  return MINDMAP_EXTENSIONS.includes(extensionOf(path));
}

export function rootTopicFromFileName(fileName: string): string {
  const name = fileName.split(/[\\/]/).pop() ?? '';
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return stem.trim() || DEFAULT_ROOT_TOPIC;
}

export function createEmptyMindmap(rootTopic: string): MindElixirData {
  return { nodeData: { id: ROOT_ID, topic: rootTopic, children: [] } };
}

export function serializeMindmap(data: MindElixirData): string {
  const envelope: MindmapEnvelope = { format: FORMAT_ID, version: FORMAT_VERSION, data };
  return `${JSON.stringify(envelope, null, JSON_INDENT)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNodeObj(value: unknown): value is NodeObj {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || typeof value.topic !== 'string') return false;
  if (value.children === undefined) return true;
  return Array.isArray(value.children) && value.children.every(isNodeObj);
}

function validateEnvelope(value: unknown): string | null {
  if (!isRecord(value)) return 'Mindmap file is not a JSON object';
  if (value.format !== FORMAT_ID) return `Unknown mindmap format: ${String(value.format)}`;
  if (value.version !== FORMAT_VERSION) return `Unsupported mindmap version: ${String(value.version)}`;
  if (!isRecord(value.data) || !isNodeObj(value.data.nodeData)) return 'Mindmap data has no valid root node';
  return null;
}

function sanitizeNode(node: NodeObj): NodeObj {
  const copy: NodeObj = { ...node };
  delete copy.dangerouslySetInnerHTML;
  if (copy.hyperLink !== undefined && !SAFE_LINK_PATTERN.test(copy.hyperLink)) delete copy.hyperLink;
  if (copy.children) copy.children = copy.children.map(sanitizeNode);
  return copy;
}

function stripAngleBrackets(label: string): string {
  return label.replace(ANGLE_BRACKET_PATTERN, '');
}

function sanitizeLabels<T extends { label?: unknown }>(items: T[]): T[] {
  return items.map((item) =>
    typeof item.label === 'string' ? { ...item, label: stripAngleBrackets(item.label) } : item,
  );
}

export function sanitizeMindmapData(data: MindElixirData): MindElixirData {
  const sanitized: MindElixirData = { ...data, nodeData: sanitizeNode(data.nodeData) };
  if (Array.isArray(data.arrows)) sanitized.arrows = sanitizeLabels(data.arrows);
  if (Array.isArray(data.summaries)) sanitized.summaries = sanitizeLabels(data.summaries);
  return sanitized;
}

export function parseMindmap(text: string, fallbackTopic: string): MindmapParseResult {
  if (text.trim() === '') return { ok: true, data: createEmptyMindmap(fallbackTopic), isEmpty: true };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${(err as Error).message}` };
  }
  const error = validateEnvelope(json);
  if (error) return { ok: false, error };
  return { ok: true, data: sanitizeMindmapData((json as MindmapEnvelope).data), isEmpty: false };
}
