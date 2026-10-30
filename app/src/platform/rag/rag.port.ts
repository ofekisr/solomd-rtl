import { z } from 'zod';
import type { CommandCatalog, CommandPort } from '../ipc/command.port.ts';

const ragStatus = z.object({
  enabled: z.boolean(),
  ready: z.boolean(),
  total_files: z.number(),
  indexed_files: z.number(),
  total_chunks: z.number(),
  backend: z.string(),
  index_version: z.number(),
});

const ragHit = z.object({
  path: z.string(),
  name: z.string(),
  chunk_idx: z.number(),
  char_start: z.number(),
  char_end: z.number(),
  score: z.number(),
  snippet: z.string(),
});

const wikilinkRef = z.object({
  target: z.string(),
  heading: z.string().nullable(),
  alias: z.string().nullable(),
  line: z.number(),
});

const taskRef = z.object({ line: z.number(), text: z.string(), done: z.boolean() });

const indexEntry = z.object({
  path: z.string(),
  name: z.string(),
  stem: z.string(),
  mtime: z.number(),
  size: z.number(),
  frontmatter: z.record(z.string(), z.unknown()).nullable(),
  wikilinks: z.array(wikilinkRef),
  tags: z.array(z.string()),
  headings: z.array(z.string()),
  tasks: z.array(taskRef).optional(),
  summary: z.string(),
  title: z.string().nullable().optional(),
  relationships: z.record(z.string(), z.array(z.string())).optional(),
});

const backlinkRef = z.object({
  from_path: z.string(),
  from_name: z.string(),
  line: z.number(),
  context: z.array(z.string()),
});

const referencedByRef = z.object({
  from_path: z.string(),
  from_name: z.string(),
  via_key: z.string(),
});

const tagCount = z.object({ tag: z.string(), count: z.number(), files: z.array(z.string()) });

const folderArgs = z.object({ folder: z.string() });
const targetArgs = z.object({ target: z.string() });

export const ragCommands = {
  rag_index_status: { args: folderArgs, result: ragStatus },
  rag_reindex: { args: folderArgs, result: ragStatus },
  rag_reindex_file: { args: z.object({ folder: z.string(), filePath: z.string() }), result: z.null() },
  rag_search: {
    args: z.object({ args: z.object({ folder: z.string(), query: z.string(), limit: z.number().optional() }) }),
    result: z.array(ragHit),
  },
  rag_set_enabled: { args: z.object({ folder: z.string(), enabled: z.boolean() }), result: ragStatus },
  workspace_index_backlinks: { args: targetArgs, result: z.array(backlinkRef) },
  workspace_index_files: { result: z.array(indexEntry) },
  workspace_index_init: { args: folderArgs, result: z.number() },
  workspace_index_referenced_by: { args: targetArgs, result: z.array(referencedByRef) },
  workspace_index_rescan: { result: z.number() },
  workspace_index_resolve: { args: z.object({ name: z.string() }), result: z.string().nullable() },
  workspace_index_tags: { result: z.array(tagCount) },
} satisfies CommandCatalog;

export type RagPort = CommandPort<typeof ragCommands>;
