import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileFind, replaceLines, replacementFor, type FindSpec } from './find-spec.ts';
import { applyWrapPreset, WRAP_PRESETS } from './find-wrap-presets.ts';

const preset = (id: string) => WRAP_PRESETS.find((p) => p.id === id)!;
const base = (over: Partial<FindSpec>): FindSpec => ({ search: '', replace: '', caseSensitive: true, regexp: false, ...over });

function wrapAll(spec: FindSpec, text: string): string {
  return replaceLines(text, compileFind(spec)!, replacementFor(spec)).text;
}

test('code preset wraps every literal match in backticks', () => {
  const spec = applyWrapPreset(base({ search: ':find' }), preset('code'));
  assert.equal(wrapAll(spec, 'use :find and :find'), 'use `:find` and `:find`');
});

test('literal search is escaped when switching to regex', () => {
  const spec = applyWrapPreset(base({ search: 'a.b' }), preset('bold'));
  assert.equal(spec.regexp, true);
  assert.equal(wrapAll(spec, 'a.b axb'), '**a.b** axb');
});

test('regex search is kept as-is', () => {
  const spec = applyWrapPreset(base({ search: '\\d+', regexp: true }), preset('quote'));
  assert.equal(wrapAll(spec, 'x 12 y 3'), 'x "12" y "3"');
});

test('wrap presets skip Markdown code', () => {
  assert.equal(applyWrapPreset(base({ search: 'x' }), preset('code')).skipCode, true);
});
