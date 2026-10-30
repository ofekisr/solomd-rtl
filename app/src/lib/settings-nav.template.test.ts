import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SETTINGS_PAGES } from '../features/settings/ui/settings-pages.ts';
import { ALL_PAGE_KEYS, categoryOf } from './settings-nav.ts';

const PAGES_DIR = new URL('../features/settings/ui/pages/', import.meta.url);
const BLOCK_OPEN = /^ {2,}<(?:section|div)\b[^>]*\bdata-cat="([a-z]+)"[^>]*>/gm;
const PAGE_FILE = /^([A-Z][a-z]+)((?:[A-Z][a-z]+)+)Page\.vue$/;

interface Block {
  cat: string;
  page: string | null;
  line: string;
}

interface PageFile {
  file: string;
  key: string;
  blocks: Block[];
}

function keyOfFile(file: string): string {
  const [, cat, rest] = PAGE_FILE.exec(file) ?? [];
  assert.ok(cat, `unexpected page file name ${file}`);
  const words = rest.match(/[A-Z][a-z]+/g) ?? [];
  return `${cat.toLowerCase()}/${words.join('-').toLowerCase()}`;
}

function readPages(): PageFile[] {
  return readdirSync(PAGES_DIR)
    .filter((f) => f.endsWith('.vue'))
    .map((file) => {
      const text = readFileSync(new URL(file, PAGES_DIR), 'utf8');
      const blocks = [...text.matchAll(BLOCK_OPEN)].map((m) => ({
        cat: m[1],
        page: /\bdata-page="([^"]+)"/.exec(m[0])?.[1] ?? null,
        line: m[0],
      }));
      return { file, key: keyOfFile(file), blocks };
    });
}

const PAGES = readPages();

test('every top-level settings block names a known page in its own category', () => {
  const known = new Set(ALL_PAGE_KEYS);
  for (const b of PAGES.flatMap((p) => p.blocks)) {
    assert.ok(b.page, `no data-page: ${b.line}`);
    assert.ok(known.has(b.page), `unknown page ${b.page}`);
    assert.equal(categoryOf(b.page), b.cat, `page/cat mismatch: ${b.line}`);
  }
});

test('each page file carries only its own data-page', () => {
  for (const p of PAGES) {
    for (const b of p.blocks) assert.equal(b.page, p.key, `${p.file} holds a foreign block: ${b.line}`);
  }
});

test('no page is left empty', () => {
  const used = new Set(PAGES.filter((p) => p.blocks.length > 0).map((p) => p.key));
  for (const key of ALL_PAGE_KEYS) assert.ok(used.has(key), `empty page ${key}`);
});

test('SETTINGS_PAGES keys equal ALL_PAGE_KEYS in order', () => {
  assert.deepEqual(
    SETTINGS_PAGES.map((p) => p.key),
    [...ALL_PAGE_KEYS],
  );
});
