import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { ServerConfig } from './config.ts';
import { MapStore } from './store.ts';
import { duplicates, find, node, outline } from './tools/read.ts';
import { add, edit, gate, move, remove } from './tools/write.ts';
import { legend, mark } from './tools/meaning.ts';
import { bindSession, sessionNodes } from './tools/session.ts';
import { isSafeColor } from '../../app/src/lib/mindmap-display.ts';
import { create, exportMap, graft, merge, reveal } from './tools/file.ts';

export const SERVER_NAME = 'solomd-mindmap';
const VERSION = '0.1.0';
const JSON_INDENT = 2;
const MAX_DEPTH = 50;
export const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
export const fileArg = z.string().describe('Map path relative to the workspace, e.g. "plans/q4.mmap"');
export const nodeArg = z.string().describe('Node id from an outline ("a1b2") or a topic path from the root ("Plan/Phase 2")');

export const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] });
export const json = (value: object) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, JSON_INDENT) }] });
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;
const DESTRUCTIVE = { ...WRITE, destructiveHint: true } as const;
const FIELD_KEY_MAX = 64;
const FIELD_VALUE_MAX = 2000;
const fieldArg = z.object({ key: z.string().min(1).max(FIELD_KEY_MAX), value: z.string().max(FIELD_VALUE_MAX) });

const COLOR_MESSAGE = 'must be a CSS colour such as #fde2e2';
const colorArg = z.string().refine(isSafeColor, { message: COLOR_MESSAGE }).optional();
export const legendEntryArg = z.object({ meaning: z.string().min(1).max(40), color: colorArg, background: colorArg });

function registerRead(server: McpServer, store: MapStore): void {
  server.registerTool('mmap_outline', {
    title: 'Map outline', annotations: READ,
    description: 'Indented outline of a map or subtree: "- Topic [^id]", gates as "→ [^target]", "{mark: x}", "{session}", "(+N)" for children cut by depth. Start here.',
    inputSchema: z.object({ file: fileArg, node: nodeArg.optional(), depth: z.number().int().min(0).max(MAX_DEPTH).optional().describe('Levels below the start node; omit for all') }),
  }, async (a) => text(await outline(store, a)));
  server.registerTool('mmap_find', {
    title: 'Find nodes', annotations: READ,
    description: 'Case-insensitive substring search. Returns "[^id] path" lines.',
    inputSchema: z.object({ file: fileArg, query: z.string().min(1), by: z.enum(['topic', 'tag', 'field', 'note']).optional() }),
  }, async (a) => text(await find(store, a)));
  server.registerTool('mmap_node', {
    title: 'Node details', annotations: READ,
    description: 'One node: topic, path, note, tags, fields, mark, bound session, gate target, gates pointing in, child count.',
    inputSchema: z.object({ file: fileArg, node: nodeArg }),
  }, async (a) => json(await node(store, a)));
  server.registerTool('mmap_duplicates', {
    title: 'Duplicate nodes', annotations: READ,
    description: 'Groups of nodes with the same topic and subtree. Merge one with mmap_gate action "merge".',
    inputSchema: z.object({ file: fileArg }),
  }, async (a) => text(await duplicates(store, a)));
}

function registerWrite(server: McpServer, store: MapStore): void {
  server.registerTool('mmap_add', {
    title: 'Add nodes', annotations: WRITE,
    description: 'Add a subtree under a parent. "outline" uses "- Topic" lines, two spaces per level; markdown headings also work.',
    inputSchema: z.object({ file: fileArg, parent: nodeArg, outline: z.string().min(1), index: z.number().int().min(0).optional() }),
  }, async (a) => text(await add(store, a)));
  server.registerTool('mmap_edit', {
    title: 'Edit node', annotations: WRITE,
    description: 'Change topic, note, tags or fields. Passing fields replaces the list (the bound Claude session is kept; unbind with mmap_bind_session). Passing tags replaces the tags. Never sets style: use mmap_mark.',
    inputSchema: z.object({ file: fileArg, node: nodeArg, topic: z.string().min(1).optional(), note: z.string().optional(), tags: z.array(z.string()).optional(), fields: z.array(fieldArg).optional() }),
  }, async (a) => text(await edit(store, a)));
  server.registerTool('mmap_move', {
    title: 'Move node', annotations: WRITE,
    description: 'Reparent a node (with its subtree). index = position among the new siblings.',
    inputSchema: z.object({ file: fileArg, node: nodeArg, parent: nodeArg, index: z.number().int().min(0).optional() }),
  }, async (a) => text(await move(store, a)));
  server.registerTool('mmap_remove', {
    title: 'Remove node', annotations: DESTRUCTIVE,
    description: 'Delete a node and its subtree. Reports gates left pointing at removed nodes.',
    inputSchema: z.object({ file: fileArg, node: nodeArg }),
  }, async (a) => text(await remove(store, a)));
  server.registerTool('mmap_gate', {
    title: 'Gates (cross-links)', annotations: DESTRUCTIVE,
    description: 'link: add a gate under "parent" pointing at "target". unlink: delete gate node "gate". merge: fold "duplicate" into "keep" and leave a gate.',
    inputSchema: z.object({
      file: fileArg,
      action: z.enum(['link', 'unlink', 'merge']),
      parent: nodeArg.optional(), target: nodeArg.optional(), gate: nodeArg.optional(),
      keep: nodeArg.optional(), duplicate: nodeArg.optional(),
    }),
  }, async (a) => text(await gate(store, a)));
}

function registerMeaning(server: McpServer, store: MapStore): void {
  server.registerTool('mmap_legend', {
    title: 'Map legend', annotations: WRITE,
    description: 'The meanings a map may use (e.g. blocked, done, risk). Without "set" it lists them; with "set" it replaces the legend. Colours are CSS hex and stay hidden from reads.',
    inputSchema: z.object({
      file: fileArg,
      set: z.array(legendEntryArg).optional(),
    }),
  }, async (a) => text(await legend(store, a)));
  server.registerTool('mmap_mark', {
    title: 'Mark node meaning', annotations: WRITE,
    description: 'Give a node a legend meaning; SoloMD shows its colours. meaning=null clears it. This is the only way to change node appearance.',
    inputSchema: z.object({ file: fileArg, node: nodeArg, meaning: z.string().nullable() }),
  }, async (a) => text(await mark(store, a)));
}

const sessionArg = z.string().describe('Claude session UUID; your own is the "claude-session-id" in your context');

function registerSession(server: McpServer, store: MapStore): void {
  server.registerTool('mmap_bind_session', {
    title: 'Bind Claude session to node', annotations: WRITE,
    description: 'Store a Claude session on a node so SoloMD can resume it ("claude --resume"). session=null unbinds. A node holds one session.',
    inputSchema: z.object({ file: fileArg, node: nodeArg, session: sessionArg.nullable() }),
  }, async (a) => text(await bindSession(store, a)));
  server.registerTool('mmap_session_nodes', {
    title: 'Nodes bound to a session', annotations: READ,
    description: 'Which node(s) a session is bound to, across the workspace or one file. Use at session start to find "your" node.',
    inputSchema: z.object({ session: sessionArg, file: fileArg.optional() }),
  }, async (a) => text(await sessionNodes(store, a)));
}

function registerFile(server: McpServer, store: MapStore): void {
  server.registerTool('mmap_create', {
    title: 'Create map', annotations: WRITE,
    description: 'New .mmap from a "- Topic" outline or from markdown headings/lists. Refuses to overwrite.',
    inputSchema: z.object({ file: fileArg, from: z.enum(['outline', 'markdown']), source: z.string().min(1), root: z.string().optional().describe('Root topic; defaults to the file name') }),
  }, async (a) => text(await create(store, a)));
  server.registerTool('mmap_merge', {
    title: 'Merge maps into a new file', annotations: WRITE,
    description: 'New .mmap whose root has one child per source map. Ids are prefixed; arrows, summaries and gates kept. Sources\' display settings and snippets are not carried over. Refuses to overwrite.',
    inputSchema: z.object({ files: z.array(fileArg).min(2), out: fileArg, root: z.string().optional().describe('Root topic; defaults to "A + B"') }),
  }, async (a) => text(await merge(store, a)));
  server.registerTool('mmap_graft', {
    title: 'Insert a map under a node', annotations: WRITE,
    description: 'Copy the whole source map (root included) under a node of the target map; default node is the root.',
    inputSchema: z.object({ file: fileArg, source: fileArg, node: nodeArg.optional() }),
  }, async (a) => text(await graft(store, a)));
  server.registerTool('mmap_export', {
    title: 'Export map as text', annotations: READ,
    description: 'outline (with ids), markdown, headings, mermaid or adjacency. Returns the text; write it with your own file tools if needed.',
    inputSchema: z.object({ file: fileArg, format: z.enum(['outline', 'markdown', 'headings', 'mermaid', 'adjacency']) }),
  }, async (a) => text(await exportMap(store, a)));
  server.registerTool('mmap_reveal', {
    title: 'Show in SoloMD', annotations: { ...READ, openWorldHint: true, idempotentHint: false },
    description: 'Open the map in the SoloMD app (macOS). Node focus is not supported yet; with "node" it only reports the node id and path.',
    inputSchema: z.object({ file: fileArg, node: nodeArg.optional() }),
  }, async (a) => text(await reveal(store, a)));
}

export function createServer(cfg: ServerConfig): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: VERSION });
  const store = new MapStore(cfg);
  registerRead(server, store);
  registerWrite(server, store);
  registerMeaning(server, store);
  registerSession(server, store);
  registerFile(server, store);
  return server;
}
