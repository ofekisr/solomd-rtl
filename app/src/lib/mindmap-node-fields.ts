import type { NodeObj } from 'mind-elixir';
import { isSafeLink } from './mindmap-format.ts';

export interface NodeFieldEntry {
  readonly key: string;
  readonly value: string;
}

export type FieldAction =
  | { kind: 'link'; url: string }
  | { kind: 'claudeResume'; command: string }
  | { kind: 'none' };

export const CLAUDE_SESSION_KEY = 'claude-session';
export const FIELD_KEY_MAX = 64;
export const FIELD_VALUE_MAX = 2000;
export const FIELDS_MAX = 50;

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WEB_LINK_PATTERN = /^https?:/i;
const ANGLE_BRACKET_PATTERN = /[<>]/g;

type Metadata = Record<string, unknown>;

function isRecord(value: unknown): value is Metadata {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanText(value: string, max: number): string {
  return value.replace(ANGLE_BRACKET_PATTERN, '').trim().slice(0, max);
}

function toEntry(value: unknown): NodeFieldEntry | null {
  if (!isRecord(value) || typeof value.key !== 'string' || typeof value.value !== 'string') return null;
  const key = cleanText(value.key, FIELD_KEY_MAX);
  return key === '' ? null : { key, value: value.value.slice(0, FIELD_VALUE_MAX) };
}

export function sanitizeFields(value: unknown): NodeFieldEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map(toEntry).filter((entry): entry is NodeFieldEntry => entry !== null).slice(0, FIELDS_MAX);
}

export function readFields(node: NodeObj): NodeFieldEntry[] {
  const metadata = node.metadata;
  return isRecord(metadata) ? sanitizeFields(metadata.fields) : [];
}

export function sanitizeMetadata(value: unknown): Metadata | undefined {
  if (!isRecord(value)) return undefined;
  const copy: Metadata = { ...value };
  const fields = sanitizeFields(copy.fields);
  if (fields.length > 0) copy.fields = fields;
  else delete copy.fields;
  return Object.keys(copy).length > 0 ? copy : undefined;
}

export function fieldsPatch(node: NodeObj, entries: readonly NodeFieldEntry[]): Partial<NodeObj> {
  const base: Metadata = isRecord(node.metadata) ? { ...node.metadata } : {};
  return { metadata: sanitizeMetadata({ ...base, fields: entries }) };
}

export function notePatch(note: string): Partial<NodeObj> {
  return { note: note.trim() === '' ? undefined : note };
}

export function isClaudeSessionId(value: string): boolean {
  return SESSION_ID_PATTERN.test(value.trim());
}

export function fieldAction(entry: NodeFieldEntry): FieldAction {
  const value = entry.value.trim();
  if (entry.key === CLAUDE_SESSION_KEY && isClaudeSessionId(value)) {
    return { kind: 'claudeResume', command: `claude --resume ${value}` };
  }
  if (WEB_LINK_PATTERN.test(value) && isSafeLink(value)) return { kind: 'link', url: value };
  return { kind: 'none' };
}

export function nodePath(node: NodeObj): string[] {
  const path: string[] = [];
  for (let current = node.parent; current; current = current.parent) path.unshift(current.topic);
  return path;
}
