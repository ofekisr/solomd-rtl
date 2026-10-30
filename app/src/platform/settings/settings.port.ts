import { z } from 'zod';
import type { CommandCatalog, CommandPort } from '../ipc/command.port.ts';

const idArgs = z.object({ id: z.string() });
const langArgs = z.object({ lang: z.string() });

const directiveGrammar = z.object({
  opening: z.string(),
  marker: z.string(),
  closing: z.string(),
  pairSeparator: z.string(),
  keyValueSeparator: z.string(),
});

const directiveDefinition = z.object({
  key: z.string(),
  type: z.string(),
  values: z.array(z.string()),
  default: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

const directiveManifest = z.object({
  sourceFile: z.string(),
  schemaVersion: z.literal(1),
  grammar: directiveGrammar,
  directives: z.array(directiveDefinition),
});

const directiveLoadResult = z.object({
  directory: z.string(),
  manifests: z.array(directiveManifest),
  warnings: z.array(z.object({ sourceFile: z.string(), reason: z.string() })),
});

const installedTheme = z.object({ id: z.string(), path: z.string() });

export const settingsCommands = {
  theme_install: { args: z.object({ id: z.string(), css: z.string() }), result: z.object({ path: z.string() }) },
  theme_json_list: { result: z.array(z.object({ id: z.string(), json: z.string() })) },
  theme_json_remove: { args: idArgs, result: z.null() },
  theme_json_save: { args: z.object({ id: z.string(), json: z.string() }), result: z.null() },
  theme_list_installed: { result: z.array(installedTheme) },
  theme_uninstall: { args: idArgs, result: z.null() },
  spellcheck_check: {
    args: z.object({ text: z.string() }),
    result: z.array(z.object({ word: z.string(), start: z.number(), end: z.number() })),
  },
  spellcheck_dicts_dir: { result: z.string() },
  spellcheck_init: { args: langArgs, result: z.number() },
  spellcheck_list_dicts: { result: z.array(z.string()) },
  directive_completions_load: { result: directiveLoadResult },
  directive_completions_open_folder: { result: z.string() },
  save_language_preference: { args: langArgs, result: z.null() },
  set_as_default_markdown_editor: { result: z.string() },
} satisfies CommandCatalog;

export type SettingsPort = CommandPort<typeof settingsCommands>;
