import type { NodeObj } from 'mind-elixir';
import { findNode, readGate, walkNodes } from './gates.ts';
import { pathTo } from './focus.ts';
import { normalizeTopic } from './duplicates.ts';
import { CLAUDE_SESSION_KEY, isClaudeSessionId, readFields, type NodeFieldEntry } from './node-fields.ts';

const PATH_SEPARATOR = '/';
const INDENT = '  ';
const DEFAULT_DEPTH = Number.POSITIVE_INFINITY;

export type Resolve = { ok: true; node: NodeObj } | { ok: false; error: string };

export interface NodeSummary {
  id: string; topic: string; path: string; note?: string; tags: string[]; fields: NodeFieldEntry[];
  mark?: string; session?: string; gateTarget?: string; gatesIn: string[]; childCount: number;
}

function childByTopic(node: NodeObj, topic: string): NodeObj | undefined {
  return (node.children ?? []).find((c) => normalizeTopic(c.topic) === normalizeTopic(topic));
}

function resolvePath(root: NodeObj, ref: string): Resolve {
  const [first, ...rest] = ref.split(PATH_SEPARATOR).map((s) => s.trim());
  if (normalizeTopic(first) !== normalizeTopic(root.topic)) return { ok: false, error: `Path must start at the root "${root.topic}"` };
  let node = root;
  for (const part of rest) {
    const next = childByTopic(node, part);
    if (!next) return { ok: false, error: `"${node.topic}" has no child "${part}"` };
    node = next;
  }
  return { ok: true, node };
}

export function resolveNode(root: NodeObj, ref: string): Resolve {
  const byId = findNode(root, ref);
  if (byId) return { ok: true, node: byId };
  return ref.includes(PATH_SEPARATOR) || normalizeTopic(ref) === normalizeTopic(root.topic)
    ? resolvePath(root, ref)
    : { ok: false, error: `No node with id "${ref}". Use an id from mmap_outline or a path like "${root.topic}/Child"` };
}

export function pathOf(root: NodeObj, id: string): string {
  return (pathTo(root, id) ?? []).map((n) => n.topic).join(PATH_SEPARATOR);
}

export function boundSession(node: NodeObj): string | null {
  const entry = readFields(node).find((f) => f.key === CLAUDE_SESSION_KEY && isClaudeSessionId(f.value));
  return entry ? entry.value.trim() : null;
}

export function readMark(node: NodeObj): string | null {
  const mark = (node.metadata as Record<string, unknown> | undefined)?.mark;
  return typeof mark === 'string' && mark !== '' ? mark : null;
}

function lineOf(node: NodeObj): string {
  const tags = (node.tags ?? []).map((t) => ` #${typeof t === 'string' ? t : t.text}`).join('');
  const mark = readMark(node);
  const gate = readGate(node);
  return `- ${node.topic} [^${node.id}]${tags}${mark ? ` {mark: ${mark}}` : ''}${boundSession(node) ? ' {session}' : ''}${gate ? ` → [^${gate.target}]` : ''}`;
}

function outlineLines(node: NodeObj, level: number, depth: number): string[] {
  const kids = node.children ?? [];
  const cut = level >= depth && kids.length > 0 ? ` (+${kids.length})` : '';
  const self = `${INDENT.repeat(level)}${lineOf(node)}${cut}`;
  return cut ? [self] : [self, ...kids.flatMap((k) => outlineLines(k, level + 1, depth))];
}

export function outlineOf(root: NodeObj, fromId?: string, depth: number = DEFAULT_DEPTH): string {
  const start = fromId ? findNode(root, fromId) : root;
  return start ? outlineLines(start, 0, depth).join('\n') : '';
}

export function describeNode(root: NodeObj, id: string): NodeSummary | null {
  const node = findNode(root, id);
  if (!node) return null;
  const summary: NodeSummary = {
    id, topic: node.topic, path: pathOf(root, id), tags: (node.tags ?? []).map((t) => (typeof t === 'string' ? t : t.text)),
    fields: readFields(node), gatesIn: walkNodes(root).filter((n) => readGate(n)?.target === id).map((n) => n.id),
    childCount: (node.children ?? []).length,
  };
  if (node.note) summary.note = node.note;
  const mark = readMark(node); if (mark) summary.mark = mark;
  const session = boundSession(node); if (session) summary.session = session;
  const gate = readGate(node); if (gate) summary.gateTarget = gate.target;
  return summary;
}
