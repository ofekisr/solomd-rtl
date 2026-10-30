import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SYNTAX_ITEMS } from './markdown-help-items.ts';

const EXPECTED_CATEGORY_ORDER = [
  'Headings', 'Emphasis', 'Lists', 'Links & Images', 'Code', 'Quotes',
  'Tables', 'Math (KaTeX)', 'Diagrams', 'Extras', 'Other',
];

test('syntax items keep their category order and shape', () => {
  const seen = [...new Set(SYNTAX_ITEMS.map((it) => it.category))];
  assert.deepEqual(seen, EXPECTED_CATEGORY_ORDER);
  for (const it of SYNTAX_ITEMS) {
    assert.ok(it.syntax && it.example && it.en);
  }
});
