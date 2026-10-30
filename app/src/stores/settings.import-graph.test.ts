import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ENTRY = fileURLToPath(new URL('./settings.ts', import.meta.url));
const RELATIVE_IMPORT = /(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g;
const EXTENSIONS = ['', '.ts', '/index.ts'];

function resolveImport(from: string, spec: string): string | undefined {
  const base = resolve(dirname(from), spec);
  return EXTENSIONS.map((ext) => base + ext).find((path) => existsSync(path) && /\.(ts|vue)$/.test(path));
}

function collectGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    if (file.endsWith('.vue')) continue;
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(RELATIVE_IMPORT)) {
      const target = resolveImport(file, match[1]);
      if (target) queue.push(target);
    }
  }
  return seen;
}

test('stores/settings.ts import graph contains no .vue file', () => {
  const vueFiles = [...collectGraph(ENTRY)].filter((file) => file.endsWith('.vue'));
  assert.deepEqual(vueFiles, []);
});
