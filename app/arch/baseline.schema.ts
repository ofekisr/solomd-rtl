import { z } from 'zod';

const WINDOWS_DRIVE_RE = /^[A-Za-z]:/;

function isRepoRelative(path: string): boolean {
  return !path.startsWith('/') && !WINDOWS_DRIVE_RE.test(path) && !path.split('/').includes('..');
}

const RepoPath = z.string().min(1).refine(isRepoRelative, 'must be a repo-relative POSIX path');

export const BaselineSchema = z.strictObject({
  version: z.literal(1),
  fileSize: z.record(RepoPath, z.number().int().positive()),
  rawIpc: z.array(RepoPath),
  libPurity: z.array(RepoPath),
});

export type Baseline = z.infer<typeof BaselineSchema>;

export function parseBaseline(raw: unknown): Baseline {
  return BaselineSchema.parse(raw);
}
