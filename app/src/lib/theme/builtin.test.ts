import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseTheme, type Theme } from './schema.ts';
import { resolveVariant } from './resolve.ts';
import { themeVars } from './css.ts';
import { BUILTIN_IDS } from './legacy.ts';

const load = (id: string): Theme => JSON.parse(readFileSync(new URL(`./builtin/${id}.json`, import.meta.url), 'utf8')) as Theme;
for (const id of BUILTIN_IDS) {
  test(`${id} is a valid theme`, () => assert.equal(parseTheme(load(id)).ok, true));
}

const NORD_EXPECTED: Record<string, string> = {
  '--bg': '#2e3440',
  '--bg-elev': '#3b4252',
  '--text': '#eceff4',
  '--accent': '#88c0d0',
  '--md-h1': '#eceff4',
  '--syn-keyword': '#81a1c1',
  '--syn-operator': '#81a1c1',
};

test('Nord resolves to its canonical palette', () => {
  const vars = themeVars(resolveVariant(load('nord').variants.dark));
  for (const [key, value] of Object.entries(NORD_EXPECTED)) {
    assert.equal(vars[key], value, key);
  }
});

test('SoloMD dark keeps One Dark editor chrome', () => {
  assert.equal(load('solomd').variants.dark.editor?.colors?.background, '#282c34');
});
