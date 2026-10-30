import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Baseline } from './baseline.schema.ts';
import { withFixtureTree } from './fixture-tree.ts';
import { measure, rebaseline, slack } from './rebaseline.ts';

const lines = (count: number): string => 'x\n'.repeat(count);

const PREVIOUS: Baseline = {
  version: 1,
  fileSize: { 'app/src/big.vue': 700, 'app/src/fixed.ts': 450 },
  rawIpc: ['app/src/ipc.ts', 'app/src/old-ipc.ts'],
  libPurity: ['app/src/lib/impure.ts'],
};

test('measure collects every baselined rule from the tree', () => {
  withFixtureTree({
    'app/src/big.vue': lines(650),
    'app/src/ipc.ts': "import { invoke } from '@tauri-apps/api/core';",
    'app/src/lib/impure.ts': "import { ref } from 'vue';",
  }, (root) => {
    assert.deepEqual(measure(root), {
      version: 1,
      fileSize: { 'app/src/big.vue': 650 },
      rawIpc: ['app/src/ipc.ts'],
      libPurity: ['app/src/lib/impure.ts'],
    });
  });
});

test('rebaseline lowers shrunk values and drops fixed entries', () => {
  const measured: Baseline = {
    version: 1,
    fileSize: { 'app/src/big.vue': 650 },
    rawIpc: ['app/src/ipc.ts'],
    libPurity: [],
  };
  assert.deepEqual(rebaseline(PREVIOUS, measured), {
    baseline: { version: 1, fileSize: { 'app/src/big.vue': 650 }, rawIpc: ['app/src/ipc.ts'], libPurity: [] },
    increases: [],
  });
});

test('rebaseline refuses an increase (fixture baseline + fixture file)', () => {
  withFixtureTree({
    'app/src/big.vue': lines(701),
    'app/src/new-ipc.ts': "import { invoke } from '@tauri-apps/api/core';",
  }, (root) => {
    const { increases } = rebaseline(PREVIOUS, measure(root));
    assert.equal(increases.length, 2);
    assert.match(increases[0], /^\[arch:file-size\] app\/src\/big\.vue has 701 lines; baseline 700\./);
    assert.match(increases[1], /^\[arch:raw-ipc\] app\/src\/new-ipc\.ts imports/);
  });
});

test('slack is empty when nothing would change', () => {
  assert.deepEqual(slack(PREVIOUS, PREVIOUS), []);
});

test('slack lists every entry a rebaseline would lower or drop', () => {
  const next: Baseline = {
    version: 1,
    fileSize: { 'app/src/big.vue': 650 },
    rawIpc: ['app/src/ipc.ts'],
    libPurity: [],
  };
  assert.deepEqual(slack(PREVIOUS, next), [
    '[arch:tight] fileSize app/src/big.vue: 700 → 650',
    '[arch:tight] fileSize app/src/fixed.ts: 450 → removed',
    '[arch:tight] rawIpc app/src/old-ipc.ts: removed',
    '[arch:tight] libPurity app/src/lib/impure.ts: removed',
  ]);
});
