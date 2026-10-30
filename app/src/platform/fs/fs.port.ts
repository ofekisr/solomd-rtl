import { z } from 'zod';
import type { CommandCatalog, CommandPort } from '../ipc/command.port.ts';

const pathArgs = z.object({ path: z.string() });
const fromToArgs = z.object({ from: z.string(), to: z.string() });
const rootArgs = z.object({ root: z.string(), showHidden: z.boolean().optional() });

const searchOptions = z.object({
  regex: z.boolean().optional(),
  caseSensitive: z.boolean().optional(),
  skipCode: z.boolean().optional(),
});

const language = z.enum([
  'markdown',
  'mindmap',
  'git-diff',
  'theme-studio',
  'python',
  'javascript',
  'typescript',
  'vue',
  'svelte',
  'scss',
  'less',
  'sass',
  'rust',
  'html',
  'css',
  'json',
  'cpp',
  'go',
  'sql',
  'java',
  'yaml',
  'xml',
  'bash',
  'plaintext',
]);

const fileReadResult = z.object({
  content: z.string(),
  encoding: z.string(),
  language,
  had_bom: z.boolean(),
});

const dirEntry = z.object({
  name: z.string(),
  path: z.string(),
  is_dir: z.boolean(),
  modified: z.number().optional(),
  created: z.number().optional(),
});

const searchHit = z.object({
  file: z.string(),
  line: z.number(),
  snippet: z.string(),
  ranges: z.array(z.tuple([z.number(), z.number()])),
  preview: z.string().nullable(),
  nodeId: z.string().nullable(),
  field: z.string().nullable(),
});

const replaceRequest = z.object({
  root: z.string(),
  query: z.string(),
  replacement: z.string(),
  options: searchOptions.optional(),
  only: z.array(z.string()).nullable().optional(),
  exclude: z.array(z.string()).optional(),
  dryRun: z.boolean().optional(),
});

export const fsCommands = {
  copy_file: { args: z.object({ src: z.string(), dst: z.string() }), result: z.null() },
  delete_frontmatter_property: { args: z.object({ path: z.string(), key: z.string() }), result: z.string() },
  fs_create_dir: { args: pathArgs, result: z.null() },
  fs_create_file: { args: z.object({ path: z.string(), content: z.string().optional() }), result: z.null() },
  fs_delete: { args: pathArgs, result: z.null() },
  fs_dir_exists: { args: pathArgs, result: z.boolean() },
  fs_dirs_with_extensions: {
    args: z.object({ root: z.string(), exts: z.array(z.string()), showHidden: z.boolean().optional() }),
    result: z.array(z.string()),
  },
  fs_file_exists: { args: pathArgs, result: z.boolean() },
  fs_list_dirs: { args: rootArgs, result: z.array(z.string()) },
  fs_list_extensions: { args: rootArgs, result: z.array(z.object({ ext: z.string(), count: z.number() })) },
  fs_move: { args: fromToArgs, result: z.null() },
  fs_rename: { args: fromToArgs, result: z.null() },
  list_dir: {
    args: z.object({ path: z.string(), showHidden: z.boolean().optional(), withTimes: z.boolean().optional() }),
    result: z.array(dirEntry),
  },
  read_binary_file: { args: pathArgs, result: z.array(z.number()) },
  read_file: { args: pathArgs, result: fileReadResult },
  update_frontmatter_property: {
    args: z.object({ path: z.string(), key: z.string(), value: z.unknown() }),
    result: z.string(),
  },
  write_binary_file: { args: z.object({ path: z.string(), data: z.array(z.number()) }), result: z.null() },
  write_file: {
    args: z.object({
      path: z.string(),
      content: z.string(),
      encoding: z.string(),
      workspace: z.string().nullable().optional(),
    }),
    result: z.null(),
  },
  watch_file: { args: pathArgs, result: z.null() },
  unwatch_file: { args: pathArgs, result: z.null() },
  search_in_dir: {
    args: z.object({
      root: z.string(),
      query: z.string(),
      maxResults: z.number(),
      options: searchOptions.nullable().optional(),
      replacement: z.string().nullable().optional(),
    }),
    result: z.array(searchHit),
  },
  replace_in_dir: {
    args: z.object({ request: replaceRequest }),
    result: z.object({ filesChanged: z.number(), replacements: z.number(), errors: z.array(z.string()) }),
  },
  replace_in_text: {
    args: z.object({
      text: z.string(),
      query: z.string(),
      replacement: z.string(),
      options: searchOptions.nullable().optional(),
      filePath: z.string().nullable().optional(),
    }),
    result: z.object({ text: z.string(), count: z.number() }),
  },
} satisfies CommandCatalog;

export type FsPort = CommandPort<typeof fsCommands>;
