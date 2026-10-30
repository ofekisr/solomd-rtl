import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { fixture, CONFIGS, PDF_OPTS } from './pdf-harness-fixture.ts';

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

test('fixture output is unchanged from the original harness', () => {
  assert.equal(sha(fixture(1)), 'ecfebebb96717c6a71f9f04885c16cc06660a1ffb2a203ca6e13318b5fbc6e25');
  assert.equal(sha(fixture(3)), 'c94f8db4f40e17428208df738ce73a1385cfd0ec02275c51bfe7ebf603e86fa5');
});

test('page setups', () => {
  assert.deepEqual(CONFIGS.map((c) => c.label), ['A4 · 10mm margins', 'A4 · 25mm margins', 'A5 · 15mm margins']);
  assert.deepEqual(CONFIGS[2].opts.pageSizeMm, { width: 148, height: 210 });
  assert.deepEqual(CONFIGS[1].opts.marginMm, { top: 25, right: 25, bottom: 27, left: 25 });
  assert.equal(PDF_OPTS.marginMm?.bottom, 12);
});
