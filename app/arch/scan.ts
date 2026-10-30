import ts from 'typescript';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

const SKIPPED_DIRS = new Set(['node_modules', 'target', 'dist', 'i18n']);
const TEST_FILE_SUFFIX = '.test.ts';
const SFC_SUFFIX = '.vue';
const SCRIPT_BLOCK = /<script\b[^>]*>([\s\S]*?)<\/script>/g;

export function listSourceFiles(repoRoot: string, roots: readonly string[], exts: readonly string[]): string[] {
  const found: string[] = [];
  for (const root of roots) walk(join(repoRoot, root), exts, found);
  return [...new Set(found)].map((abs) => toRepoPath(repoRoot, abs)).sort();
}

export function extractImports(source: string, path = ''): string[] {
  const code = path.endsWith(SFC_SUFFIX) ? scriptBlocks(source) : source;
  const specifiers = ts.preProcessFile(code, true, true).importedFiles.map((file) => file.fileName);
  return [...new Set(specifiers)];
}

export function countLines(source: string): number {
  if (source === '') return 0;
  const lines = source.split('\n').length;
  return source.endsWith('\n') ? lines - 1 : lines;
}

export function toRepoPath(repoRoot: string, absPath: string): string {
  return relative(repoRoot, absPath).split(sep).join('/');
}

export function readRepoFile(repoRoot: string, repoPath: string): string {
  return readFileSync(join(repoRoot, repoPath), 'utf8');
}

function scriptBlocks(source: string): string {
  return [...source.matchAll(SCRIPT_BLOCK)].map((match) => match[1]).join('\n');
}

function walk(dir: string, exts: readonly string[], found: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) walk(abs, exts, found);
      continue;
    }
    if (isSourceFile(entry.name, exts)) found.push(abs);
  }
}

function isSourceFile(name: string, exts: readonly string[]): boolean {
  return !name.endsWith(TEST_FILE_SUFFIX) && exts.some((ext) => name.endsWith(ext));
}
