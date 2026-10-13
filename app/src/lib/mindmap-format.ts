import type { MindElixirData, NodeObj } from 'mind-elixir';
import { parseMapDisplay, type MapDisplay } from './mindmap-display.ts';
import { sanitizeSnippets, type Snippet } from './mindmap-snippets.ts';
import { sanitizeMetadata } from './mindmap-node-fields.ts';

export const MMAP_EXTENSION = 'mmap';
export const XMIND_EXTENSION = 'xmind';
export const MINDMAP_EXTENSIONS: readonly string[] = [MMAP_EXTENSION, XMIND_EXTENSION];

const FORMAT_ID = 'solomd-mindmap';
const FORMAT_VERSION = 1;
const JSON_INDENT = 2;
const ROOT_ID = 'root';
const DEFAULT_ROOT_TOPIC = 'Untitled';
const ALLOWED_STYLE_KEYS: readonly string[] = [
  'color',
  'background',
  'fontSize',
  'fontWeight',
  'fontFamily',
  'textDecoration',
  'width',
  'border',
];
const UNSAFE_CSS_VALUE_PATTERN = /url\(|image-set\(|expression\(|@import|javascript:/i;
const CSS_ESCAPE_PATTERN = /[\\\u0000-\u001f\u007f]/;
const SAFE_LINK_PATTERN = /^(https?:|mailto:)/i;

export function isSafeLink(value: string): boolean {
  return SAFE_LINK_PATTERN.test(value.trim());
}
const SAFE_IMAGE_URL_PATTERN = /^https?:/i;
const ANGLE_BRACKET_PATTERN = /[<>]/g;
const TRAILING_EXTENSION_PATTERN = /\.[^.\\/]+$/;
const LAYOUT_DIRECTIONS: readonly unknown[] = [0, 1, 2, 3];

interface MindmapEnvelope {
  format: typeof FORMAT_ID;
  version: typeof FORMAT_VERSION;
  data: MindElixirData;
  display?: MapDisplay;
  snippets?: Snippet[];
}

export type MindmapParseResult =
  | { ok: true; data: MindElixirData; isEmpty: boolean; display: MapDisplay; snippets: Snippet[] }
  | { ok: false; error: string };

function extensionOf(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? '';
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase();
}

export function isMindmapPath(path: string): boolean {
  return MINDMAP_EXTENSIONS.includes(extensionOf(path));
}

export function isXmindPath(path: string): boolean {
  return extensionOf(path) === XMIND_EXTENSION;
}

export function mmapPathFor(sourcePath: string): string {
  return `${sourcePath.replace(TRAILING_EXTENSION_PATTERN, '')}.${MMAP_EXTENSION}`;
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

function documentFields(data: MindElixirData): MindElixirData {
  const { nodeData, arrows, summaries, direction } = data;
  return { nodeData, arrows, summaries, direction };
}

export function serializeMindmap(data: MindElixirData, display: MapDisplay = {}, snippets: readonly Snippet[] = []): string {
  const envelope: MindmapEnvelope = { format: FORMAT_ID, version: FORMAT_VERSION, data: documentFields(data) };
  if (Object.keys(display).length > 0) envelope.display = display;
  if (snippets.length > 0) envelope.snippets = [...snippets];
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

type TagEntry = NonNullable<NodeObj['tags']>[number];

function sanitizeTag(tag: unknown): TagEntry | null {
  if (typeof tag === 'string') return tag;
  if (isRecord(tag) && typeof tag.text === 'string') return { text: tag.text };
  return null;
}

function sanitizeTags(tags: unknown): TagEntry[] | undefined {
  if (!Array.isArray(tags)) return undefined;
  return tags.map(sanitizeTag).filter((tag): tag is TagEntry => tag !== null);
}

function sanitizeIcons(icons: unknown): string[] | undefined {
  if (!Array.isArray(icons)) return undefined;
  return icons.filter((icon): icon is string => typeof icon === 'string');
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isSafeImage(image: unknown): boolean {
  if (!isRecord(image) || typeof image.url !== 'string') return false;
  return SAFE_IMAGE_URL_PATTERN.test(image.url) && isPositiveNumber(image.width) && isPositiveNumber(image.height);
}

function isUnsafeCssValue(value: string): boolean {
  return UNSAFE_CSS_VALUE_PATTERN.test(value) || CSS_ESCAPE_PATTERN.test(value);
}

function sanitizeStyle(style: unknown): NodeObj['style'] | undefined {
  if (!isRecord(style)) return undefined;
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(style)) {
    if (!ALLOWED_STYLE_KEYS.includes(key)) continue;
    if (typeof value !== 'string' || value === '' || isUnsafeCssValue(value)) continue;
    safe[key] = value;
  }
  return Object.keys(safe).length > 0 ? safe : undefined;
}

function sanitizeNode(node: NodeObj): NodeObj {
  const copy: NodeObj = { ...node };
  delete copy.dangerouslySetInnerHTML;
  if (copy.hyperLink !== undefined && !isSafeLink(copy.hyperLink)) delete copy.hyperLink;
  if (copy.image !== undefined && !isSafeImage(copy.image)) delete copy.image;
  const style = sanitizeStyle(copy.style);
  if (style) copy.style = style;
  else delete copy.style;
  const tags = sanitizeTags(copy.tags);
  if (tags) copy.tags = tags;
  else delete copy.tags;
  const icons = sanitizeIcons(copy.icons);
  if (icons) copy.icons = icons;
  else delete copy.icons;
  const metadata = sanitizeMetadata(copy.metadata);
  if (metadata) copy.metadata = metadata;
  else delete copy.metadata;
  if (copy.children) copy.children = copy.children.map(sanitizeNode);
  return copy;
}

export function sanitizeNodeObj(value: unknown): NodeObj | null {
  return isNodeObj(value) ? sanitizeNode(value) : null;
}

function stripAngleBrackets(label: string): string {
  return label.replace(ANGLE_BRACKET_PATTERN, '');
}

type LabeledItem = Record<string, unknown>;
type ArrowList = NonNullable<MindElixirData['arrows']>;
type SummaryList = NonNullable<MindElixirData['summaries']>;

function sanitizeLabeledItem(item: LabeledItem): LabeledItem {
  const copy: LabeledItem = { ...item };
  if (typeof copy.label === 'string') copy.label = stripAngleBrackets(copy.label);
  else delete copy.label;
  return copy;
}

function sanitizeLabeledList<T extends unknown[]>(list: unknown): T | undefined {
  if (!Array.isArray(list)) return undefined;
  return list.filter(isRecord).map(sanitizeLabeledItem) as T;
}

function optionalField<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

type LayoutDirection = NonNullable<MindElixirData['direction']>;

function validDirection(direction: unknown): LayoutDirection | undefined {
  return LAYOUT_DIRECTIONS.includes(direction) ? (direction as LayoutDirection) : undefined;
}

export function sanitizeMindmapData(data: MindElixirData): MindElixirData {
  const { arrows, summaries, direction, theme: _theme, ...rest } = data;
  return {
    ...rest,
    nodeData: sanitizeNode(data.nodeData),
    ...optionalField('arrows', sanitizeLabeledList<ArrowList>(arrows)),
    ...optionalField('summaries', sanitizeLabeledList<SummaryList>(summaries)),
    ...optionalField('direction', validDirection(direction)),
  };
}

export function parseMindmap(text: string, fallbackTopic: string): MindmapParseResult {
  if (text.trim() === '') return { ok: true, data: createEmptyMindmap(fallbackTopic), isEmpty: true, display: {}, snippets: [] };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${(err as Error).message}` };
  }
  const error = validateEnvelope(json);
  if (error) return { ok: false, error };
  const envelope = json as MindmapEnvelope;
  return {
    ok: true,
    data: sanitizeMindmapData(envelope.data),
    isEmpty: false,
    display: parseMapDisplay(envelope.display),
    snippets: sanitizeSnippets(envelope.snippets),
  };
}

export interface MindmapCodec {
  parse(text: string): MindmapParseResult;
  serialize(data: MindElixirData, display?: MapDisplay, snippets?: readonly Snippet[]): string;
}

export function mmapCodec(fileName: string): MindmapCodec {
  const fallbackTopic = rootTopicFromFileName(fileName);
  return {
    parse: (text) => parseMindmap(text, fallbackTopic),
    serialize: (data, display, snippets) => serializeMindmap(data, display, snippets),
  };
}
