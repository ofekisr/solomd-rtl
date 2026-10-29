import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ALL_PAGE_KEYS, categoryOf } from './settings-nav.ts';

const PANEL = readFileSync(new URL('../components/SettingsPanel.vue', import.meta.url), 'utf8');
const BLOCK_OPEN = /^ {8,}<(?:section|div)\b[^>]*\bdata-cat="([a-z]+)"[^>]*>/gm;

function blocks(): { cat: string; page: string | null; line: string }[] {
  return [...PANEL.matchAll(BLOCK_OPEN)].map((m) => ({
    cat: m[1],
    page: /\bdata-page="([^"]+)"/.exec(m[0])?.[1] ?? null,
    line: m[0],
  }));
}

test('every top-level settings block names a known page in its own category', () => {
  const known = new Set(ALL_PAGE_KEYS);
  for (const b of blocks()) {
    assert.ok(b.page, `no data-page: ${b.line}`);
    assert.ok(known.has(b.page), `unknown page ${b.page}`);
    assert.equal(categoryOf(b.page), b.cat, `page/cat mismatch: ${b.line}`);
  }
});

test('no page is left empty', () => {
  const used = new Set(blocks().map((b) => b.page));
  for (const key of ALL_PAGE_KEYS) assert.ok(used.has(key), `empty page ${key}`);
});
