import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseTheme, type Theme } from './schema.ts';
import { resolveVariant } from './resolve.ts';
import { themeVars } from './css.ts';
import { parseRules, modeSelectorsOf } from './css-vars.ts';
import { BUILTIN_IDS } from './legacy.ts';

const load = (id: string): Theme => JSON.parse(readFileSync(new URL(`./builtin/${id}.json`, import.meta.url), 'utf8')) as Theme;
const MAIN = parseRules(readFileSync(new URL('../../styles/main.css', import.meta.url), 'utf8'));

function mainVars(name: string): Record<string, string> {
  const base = MAIN.filter((r) => modeSelectorsOf(r).includes('base')).reduce((a, r) => ({ ...a, ...r.decls }), {});
  const own = MAIN.filter((r) => modeSelectorsOf(r).includes(name)).reduce((a, r) => ({ ...a, ...r.decls }), {});
  return { ...base, ...own };
}

for (const id of BUILTIN_IDS) {
  test(`${id} is a valid theme`, () => assert.equal(parseTheme(load(id)).ok, true));
}

test('Nord resolves to the same palette main.css paints today', () => {
  const vars = themeVars(resolveVariant(load('nord').variants.dark));
  const expected = mainVars('nord');
  for (const key of ['--bg', '--bg-elev', '--text', '--accent', '--md-h1', '--syn-keyword', '--syn-operator']) {
    assert.equal(vars[key], expected[key], key);
  }
});

test('SoloMD dark keeps One Dark editor chrome', () => {
  assert.equal(load('solomd').variants.dark.editor?.colors?.background, '#282c34');
});
