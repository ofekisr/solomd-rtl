import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkFeatureBoundary, findBoundaryViolation } from './feature-boundary.rule.ts';
import { withFixtureTree } from './fixture-tree.ts';

test('a file outside a feature may not import its internal/', () => {
  assert.equal(
    findBoundaryViolation('app/src/App.vue', './features/git/internal/git.service.ts'),
    'app/src/features/git/internal/git.service.ts',
  );
});

test('another feature may not import internal/, but may import contracts/', () => {
  const importer = 'app/src/features/editor/ui/Editor.vue';
  assert.equal(findBoundaryViolation(importer, '../../git/internal/git.store.ts'), 'app/src/features/git/internal/git.store.ts');
  assert.equal(findBoundaryViolation(importer, '../../git/contracts/git.port.ts'), null);
});

test('a feature may import its own internal/ and bare packages are ignored', () => {
  assert.equal(findBoundaryViolation('app/src/features/git/ui/GitPane.vue', '../internal/git.store.ts'), null);
  assert.equal(findBoundaryViolation('app/src/App.vue', 'vue'), null);
});

test('checkFeatureBoundary passes when no features/ exists yet', () => {
  withFixtureTree({ 'app/src/App.vue': "import x from './lib/x.ts';" }, (root) => {
    assert.deepEqual(checkFeatureBoundary(root), []);
  });
});

test('checkFeatureBoundary reports each crossing import', () => {
  withFixtureTree({
    'app/src/App.vue': "import { s } from './features/git/internal/git.service.ts';",
    'app/src/features/git/internal/git.service.ts': 'export const s = 1;',
  }, (root) => {
    assert.deepEqual(checkFeatureBoundary(root), [
      '[arch:feature-boundary] app/src/App.vue imports app/src/features/git/internal/git.service.ts, which is private to feature "git". Import from app/src/features/git/contracts/ instead. See app/arch/CLAUDE.md.',
    ]);
  });
});
