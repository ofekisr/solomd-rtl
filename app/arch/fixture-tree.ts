import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const FIXTURE_PREFIX = 'arch-fixture-';

export function withFixtureTree(files: Record<string, string>, run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), FIXTURE_PREFIX));
  try {
    for (const [repoPath, content] of Object.entries(files)) writeFixtureFile(root, repoPath, content);
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeFixtureFile(root: string, repoPath: string, content: string): void {
  const abs = join(root, repoPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}
