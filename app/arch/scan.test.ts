import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withFixtureTree } from './fixture-tree.ts';
import { countLines, extractImports, listSourceFiles } from './scan.ts';

test('extractImports finds static, type-only, side-effect, dynamic and re-export specifiers', () => {
  const source = [
    "import a from 'alpha';",
    "import { b,",
    "  c as d } from './beta.ts';",
    "import * as ns from 'gamma';",
    "import type { T } from './types.ts';",
    "import { type U, v } from 'delta';",
    "import 'side-effect.css';",
    "const lazy = () => import('./lazy.vue');",
    "export { e } from './epsilon.ts';",
    "export * from 'zeta';",
    "export type { W } from './omega.ts';",
  ].join('\n');
  assert.deepEqual(extractImports(source), [
    'alpha', './beta.ts', 'gamma', './types.ts', 'delta', 'side-effect.css',
    './lazy.vue', './epsilon.ts', 'zeta', './omega.ts',
  ]);
});

test('extractImports ignores string literals that are not imports and de-duplicates', () => {
  const source = "export const name = 'vue';\nimport x from 'vue';\nimport y from 'vue';";
  assert.deepEqual(extractImports(source), ['vue']);
});

test('listSourceFiles returns sorted repo paths and skips excluded dirs and tests', () => {
  withFixtureTree({
    'app/src/b.ts': '',
    'app/src/a.vue': '',
    'app/src/a.test.ts': '',
    'app/src/i18n/en.ts': '',
    'app/src/node_modules/x/index.ts': '',
    'app/src/dist/out.ts': '',
    'app/src-tauri/target/gen.rs': '',
    'app/src-tauri/src/main.rs': '',
    'app/src/readme.md': '',
  }, (root) => {
    assert.deepEqual(
      listSourceFiles(root, ['app/src', 'app/src-tauri'], ['.ts', '.vue', '.rs']),
      ['app/src-tauri/src/main.rs', 'app/src/a.vue', 'app/src/b.ts'],
    );
  });
});

test('listSourceFiles tolerates a missing root', () => {
  withFixtureTree({ 'app/src/a.ts': '' }, (root) => {
    assert.deepEqual(listSourceFiles(root, ['app/src', 'app/src/features'], ['.ts']), ['app/src/a.ts']);
  });
});

test('countLines matches wc -l for files ending in a newline', () => {
  assert.equal(countLines(''), 0);
  assert.equal(countLines('one\n'), 1);
  assert.equal(countLines('one\ntwo\n'), 2);
  assert.equal(countLines('one\ntwo'), 2);
});
