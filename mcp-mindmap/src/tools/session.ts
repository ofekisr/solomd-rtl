import type { NodeObj } from 'mind-elixir';
import { walkNodes } from '../../../app/src/lib/mindmap/gates.ts';
import { CLAUDE_SESSION_KEY, fieldsPatch, isClaudeSessionId, readFields } from '../../../app/src/lib/mindmap/node-fields.ts';
import { boundSession, pathOf } from '../../../app/src/lib/mindmap/address.ts';
import { updateNode } from '../../../app/src/lib/mindmap/edit.ts';
import { requireNode, type MapStore } from '../store.ts';
import { applyEdit } from './write.ts';

const NONE = '(no node bound to this session)';
const SKIPPED_PREFIX = 'skipped unreadable:';

function sessionFields(node: NodeObj, session: string | null): Partial<NodeObj> {
  const others = readFields(node).filter((f) => f.key !== CLAUDE_SESSION_KEY);
  return fieldsPatch(node, session === null ? others : [...others, { key: CLAUDE_SESSION_KEY, value: session }]);
}

export async function bindSession(store: MapStore, a: { file: string; node: string; session: string | null }): Promise<string> {
  if (a.session !== null && !isClaudeSessionId(a.session)) throw new Error(`"${a.session}" is not a Claude session id (UUID). Use the claude-session-id from your context`);
  store.assertWritable();
  const doc = await store.load(a.file);
  const node = requireNode(doc, a.node);
  await applyEdit(store, a.file, doc, updateNode(doc.data, node.id, sessionFields(node, a.session)));
  return a.session === null ? `Unbound [^${node.id}]` : `Bound [^${node.id}] "${node.topic}" to session ${a.session}. Resume from SoloMD's details pane`;
}

async function matchesIn(store: MapStore, file: string, session: string): Promise<string[]> {
  const root = (await store.peek(file)).data.nodeData;
  return walkNodes(root).filter((n) => boundSession(n) === session).map((n) => `${file}  [^${n.id}] ${pathOf(root, n.id)}`);
}

async function scanWorkspace(store: MapStore, session: string): Promise<string[]> {
  const matches: string[] = [];
  const skipped: string[] = [];
  for (const file of await store.list()) {
    const outcome = await matchesOrSkip(store, file, session);
    if (outcome.ok) matches.push(...outcome.lines);
    else skipped.push(`${SKIPPED_PREFIX} ${file}`);
  }
  return [...matches, ...skipped];
}

async function matchesOrSkip(store: MapStore, file: string, session: string): Promise<{ ok: true; lines: string[] } | { ok: false }> {
  try {
    return { ok: true, lines: await matchesIn(store, file, session) };
  } catch {
    return { ok: false };
  }
}

export async function sessionNodes(store: MapStore, a: { session: string; file?: string }): Promise<string> {
  const lines = a.file !== undefined ? await matchesIn(store, a.file, a.session) : await scanWorkspace(store, a.session);
  return lines.join('\n') || NONE;
}
