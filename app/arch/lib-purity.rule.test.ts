import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withFixtureTree } from './fixture-tree.ts';
import { checkLibPurity, collectLibPurity, isFrameworkImport } from './lib-purity.rule.ts';

test('isFrameworkImport matches vue, pinia and any @tauri-apps package only', () => {
  for (const spec of ['vue', 'vue/server-renderer', 'pinia', '@tauri-apps/api/core', '@tauri-apps/plugin-fs']) {
    assert.equal(isFrameworkImport(spec), true, spec);
  }
  for (const spec of ['vue-router-like', './vue.ts', 'pinia-orm', 'zod', '@codemirror/view']) {
    assert.equal(isFrameworkImport(spec), false, spec);
  }
});

test('collectLibPurity scans only app/src/lib and skips tests', () => {
  withFixtureTree({
    'app/src/lib/pure.ts': "import { z } from 'zod';",
    'app/src/lib/uses-vue.ts': "import { ref } from 'vue';",
    'app/src/lib/theme/uses-tauri.ts': "const fs = await import('@tauri-apps/plugin-fs');",
    'app/src/lib/uses-pinia.test.ts': "import { defineStore } from 'pinia';",
    'app/src/stores/store.ts': "import { defineStore } from 'pinia';",
  }, (root) => {
    assert.deepEqual(collectLibPurity(root), ['app/src/lib/theme/uses-tauri.ts', 'app/src/lib/uses-vue.ts']);
  });
});

test('checkLibPurity passes baselined files and fails new ones', () => {
  assert.deepEqual(checkLibPurity(['app/src/lib/a.ts'], ['app/src/lib/a.ts']), []);
  assert.deepEqual(checkLibPurity(['app/src/lib/b.ts'], []), [
    '[arch:lib-purity] app/src/lib/b.ts imports vue, pinia or @tauri-apps/*. lib/ is pure TS: move that call into a store, composable or component. See app/arch/CLAUDE.md.',
  ]);
});
