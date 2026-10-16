import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { ServerConfig } from './config.ts';
import { MapStore } from './store.ts';
import { duplicates, find, node, outline } from './tools/read.ts';

export const SERVER_NAME = 'solomd-mindmap';
const VERSION = '0.1.0';
const JSON_INDENT = 2;
const MAX_DEPTH = 50;
export const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
export const fileArg = z.string().describe('Map path relative to the workspace, e.g. "plans/q4.mmap"');
export const nodeArg = z.string().describe('Node id from an outline ("a1b2") or a topic path from the root ("Plan/Phase 2")');

export const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] });
export const json = (value: object) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, JSON_INDENT) }] });

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

export function createServer(cfg: ServerConfig): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: VERSION });
  registerRead(server, new MapStore(cfg));
  return server;
}
