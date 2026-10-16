import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { ServerConfig } from './config.ts';
import { MapStore } from './store.ts';
import { duplicates, find, node, outline } from './tools/read.ts';
import { add, edit, gate, move, remove } from './tools/write.ts';

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
    description: 'Change topic, note, tags or fields. Passing fields or tags replaces the whole list. Never sets style: use mmap_mark.',
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
    title: 'Gates (cross-links)', annotations: WRITE,
    description: 'link: add a gate under "parent" pointing at "target". unlink: delete gate node "gate". merge: fold "duplicate" into "keep" and leave a gate.',
    inputSchema: z.discriminatedUnion('action', [
      z.object({ file: fileArg, action: z.literal('link'), parent: nodeArg, target: nodeArg }),
      z.object({ file: fileArg, action: z.literal('unlink'), gate: nodeArg }),
      z.object({ file: fileArg, action: z.literal('merge'), keep: nodeArg, duplicate: nodeArg }),
    ]),
  }, async (a) => text(await gate(store, a)));
}

export function createServer(cfg: ServerConfig): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: VERSION });
  const store = new MapStore(cfg);
  registerRead(server, store);
  registerWrite(server, store);
  return server;
}
