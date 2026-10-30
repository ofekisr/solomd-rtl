import { z } from 'zod';
import type { CommandCatalog, CommandPort } from '../ipc/command.port.ts';

const pandocInfo = z.object({ path: z.string(), version: z.string() });

const pandocExportArgs = z.object({
  input_markdown: z.string(),
  format: z.string(),
  output_path: z.string(),
  bibliography: z.string().nullable().optional(),
  csl: z.string().nullable().optional(),
  template: z.string().nullable().optional(),
  extra_args: z.array(z.string()),
});

const uploaderConfig = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('picgo'), endpoint: z.string() }),
  z.object({ kind: z.literal('command'), command: z.string() }),
  z.object({ kind: z.literal('smms'), token: z.string() }),
  z.object({
    kind: z.literal('s3'),
    endpoint: z.string(),
    region: z.string(),
    bucket: z.string(),
    accessKeyId: z.string(),
    secretAccessKey: z.string(),
    key: z.string(),
    customDomain: z.string(),
    usePathStyle: z.boolean(),
  }),
  z.object({
    kind: z.literal('github'),
    repo: z.string(),
    branch: z.string(),
    token: z.string(),
    key: z.string(),
    cdn: z.string(),
  }),
]);

export const convertCommands = {
  convert_file_to_markdown: { args: z.object({ path: z.string() }), result: z.string() },
  pandoc_detect: { result: pandocInfo.nullable() },
  pandoc_export: { args: z.object({ args: pandocExportArgs }), result: z.null() },
  upload_image: { args: z.object({ config: uploaderConfig, path: z.string() }), result: z.string() },
  print_webview: { result: z.null() },
} satisfies CommandCatalog;

export type ConvertPort = CommandPort<typeof convertCommands>;
