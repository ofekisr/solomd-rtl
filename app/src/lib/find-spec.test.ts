import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileFind, lineMatches, replaceLines, replacementFor, unicodeClasses, type FindSpec } from './find-spec.ts';

const spec = (over: Partial<FindSpec>): FindSpec => ({ search: '', replace: '', caseSensitive: false, regexp: true, ...over });

function run(over: Partial<FindSpec>, text: string) {
  const s = spec(over);
  return replaceLines(text, compileFind(s)!, replacementFor(s));
}

test('\\w and \\d match Hebrew letters and digits', () => {
  const re = compileFind(spec({ search: '^\\w+ \\d+$' }))!;
  assert.ok(lineMatches('שלום 42', re));
});

test('\\w inside a character class stays a class body', () => {
  assert.equal(unicodeClasses('[\\w-]'), '[\\p{L}\\p{N}\\p{M}_-]');
  assert.equal(unicodeClasses('\\\\w'), '\\\\w');
});

test('numbered, named and whole-match groups expand', () => {
  assert.equal(run({ search: '(\\d{4})-(\\d\\d)', replace: '$2/$1' }, 'on 2026-10').text, 'on 10/2026');
  assert.equal(run({ search: '(?<k>\\w+)=(?<v>\\w+)', replace: '$<v>=$<k>' }, 'a=b').text, 'b=a');
  assert.equal(run({ search: 'x', replace: '[$&]' }, 'axa').text, 'a[x]a');
});

test('\\n in a regex replacement inserts a newline', () => {
  assert.equal(run({ search: ', ', replace: '\\n' }, 'a, b').text, 'a\nb');
});

test('plain mode keeps $ literal and escapes the pattern', () => {
  const r = run({ regexp: false, search: '(x)', replace: '$1' }, '(x) (x)');
  assert.deepEqual(r, { text: '$1 $1', count: 2 });
});

test('^ and $ anchor per line', () => {
  assert.deepEqual(run({ search: '^', replace: '- ' }, 'a\nb'), { text: '- a\n- b', count: 2 });
});

test('invalid pattern compiles to null', () => {
  assert.equal(compileFind(spec({ search: '(' })), null);
});
