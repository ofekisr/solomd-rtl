import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkFileSize, collectFileSize } from './file-size.rule.ts';
import { withFixtureTree } from './fixture-tree.ts';

const lines = (count: number): string => 'x\n'.repeat(count);

test('collectFileSize reports only files over their budget', () => {
  withFixtureTree({
    'app/src/ok.ts': lines(400),
    'app/src/big.ts': lines(401),
    'app/src/ok.vue': lines(500),
    'app/src/big.vue': lines(501),
    'app/src-tauri/src/big.rs': lines(601),
    'mcp-mindmap/src/big.ts': lines(401),
    'app/src/big.test.ts': lines(900),
  }, (root) => {
    assert.deepEqual(collectFileSize(root), {
      'app/src/big.ts': 401,
      'app/src/big.vue': 501,
      'app/src-tauri/src/big.rs': 601,
      'mcp-mindmap/src/big.ts': 401,
    });
  });
});

test('checkFileSize passes when files are at or under their baseline', () => {
  assert.deepEqual(checkFileSize({ 'app/src/a.vue': 600 }, { 'app/src/a.vue': 600 }), []);
  assert.deepEqual(checkFileSize({ 'app/src/a.vue': 550 }, { 'app/src/a.vue': 600 }), []);
});

test('checkFileSize fails a baselined file that grew', () => {
  assert.deepEqual(checkFileSize({ 'app/src/components/Editor.vue': 5031 }, { 'app/src/components/Editor.vue': 5026 }), [
    '[arch:file-size] app/src/components/Editor.vue has 5031 lines; baseline 5026. Shrink it, or split before adding. See app/arch/CLAUDE.md.',
  ]);
});

test('checkFileSize fails a new file over budget', () => {
  assert.deepEqual(checkFileSize({ 'app/src/new.ts': 401 }, {}), [
    '[arch:file-size] app/src/new.ts has 401 lines; budget 400. Split it into smaller files. See app/arch/CLAUDE.md.',
  ]);
});
