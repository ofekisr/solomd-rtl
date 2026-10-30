import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withFixtureTree } from './fixture-tree.ts';
import { checkFeaturePurity, runtimeImports, collectFeaturePurity, collectFeaturePurityViolations, isReactiveImport, mayImportReactive } from './feature-purity.rule.ts';

test('isReactiveImport matches vue, vue/* and pinia only', () => {
  for (const spec of ['vue', 'vue/server-renderer', 'pinia']) assert.equal(isReactiveImport(spec), true, spec);
  for (const spec of ['vue-router', './vue.ts', 'pinia-orm', 'zod', '@tauri-apps/api/core']) assert.equal(isReactiveImport(spec), false, spec);
});

test('mayImportReactive allows ui/, __fixtures__/, use*.ts and *.store.ts', () => {
  for (const path of ['app/src/features/a/internal/__fixtures__/capture.fixture.ts', 'app/src/features/a/ui/A.vue', 'app/src/features/a/ui/deep/helper.ts', 'app/src/features/a/internal/useBus.ts', 'app/src/features/a/internal/a.store.ts']) {
    assert.equal(mayImportReactive(path), true, path);
  }
  for (const path of ['app/src/features/a/internal/x.service.ts', 'app/src/features/a/internal/user.ts', 'app/src/features/a/internal/usebus.ts', 'app/src/features/a/internal/A.vue']) {
    assert.equal(mayImportReactive(path), false, path);
  }
});

test('collectFeaturePurity fails a service importing vue and passes ui, composable and store files', () => {
  withFixtureTree({
    'app/src/features/a/internal/x.service.ts': "import { ref } from 'vue';",
    'app/src/features/a/internal/y.service.ts': "import { defineStore } from 'pinia';",
    'app/src/features/a/internal/pure.service.ts': "import { z } from 'zod';",
    'app/src/features/a/ui/A.vue': '<script setup lang="ts">\nimport { ref } from \'vue\';\n</script>',
    'app/src/features/a/internal/useX.ts': "import { ref } from 'vue';",
    'app/src/features/a/internal/__fixtures__/cap.fixture.ts': "import { createPinia } from 'pinia';",
    'app/src/features/a/internal/a.store.ts': "import { defineStore } from 'pinia';",
    'app/src/features/a/internal/x.service.test.ts': "import { ref } from 'vue';",
    'app/src/lib/outside.ts': "import { ref } from 'vue';",
  }, (root) => {
    assert.deepEqual(collectFeaturePurity(root), ['app/src/features/a/internal/x.service.ts', 'app/src/features/a/internal/y.service.ts']);
    assert.deepEqual(collectFeaturePurityViolations(root).map((violation) => violation.module), ['vue', 'pinia']);
  });
});

test('checkFeaturePurity passes baselined files and fails new ones', () => {
  assert.deepEqual(checkFeaturePurity(['app/src/features/a/internal/x.ts'], ['app/src/features/a/internal/x.ts']), []);
  const modules = new Map([['app/src/features/a/internal/y.ts', 'vue']]);
  assert.deepEqual(checkFeaturePurity(['app/src/features/a/internal/y.ts'], [], modules), [
    '[arch:feature-purity] app/src/features/a/internal/y.ts imports vue. Only ui/, use*.ts and *.store.ts may import vue/pinia under features/. See app/arch/CLAUDE.md.',
  ]);
});

test('runtimeImports ignores type-only imports and keeps runtime ones', () => {
  const path = 'app/src/features/a/internal/x.ts';
  assert.deepEqual(runtimeImports("import type { Ref } from 'vue';", path), []);
  assert.deepEqual(runtimeImports("import { type Ref, type ComputedRef } from 'vue';", path), []);
  assert.deepEqual(runtimeImports("import { type Ref, ref } from 'vue';", path), ['vue']);
  assert.deepEqual(runtimeImports("import { ref } from 'vue';", path), ['vue']);
  assert.deepEqual(runtimeImports("const m = await import('pinia');", path), ['pinia']);
});

test('collectFeaturePurity passes files that only import vue types', () => {
  withFixtureTree({
    'app/src/features/a/internal/types.ts': "import type { Ref } from 'vue';\nimport { type ComputedRef } from 'vue';",
    'app/src/features/a/internal/bad.ts': "import { type Ref, ref } from 'vue';",
  }, (root) => {
    assert.deepEqual(collectFeaturePurity(root), ['app/src/features/a/internal/bad.ts']);
  });
});
