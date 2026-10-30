import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withFixtureTree } from './fixture-tree.ts';
import { checkRawIpc, collectRawIpc } from './raw-ipc.rule.ts';

test('collectRawIpc finds static and dynamic imports of @tauri-apps/api/core in app/src', () => {
  withFixtureTree({
    'app/src/a.ts': "import { invoke } from '@tauri-apps/api/core';",
    'app/src/b.vue': "<script setup lang=\"ts\">\nconst { invoke } = await import('@tauri-apps/api/core');\n</script>",
    'app/src/c.ts': "import { open } from '@tauri-apps/plugin-dialog';",
    'app/src/d.test.ts': "import { invoke } from '@tauri-apps/api/core';",
    'mcp-mindmap/src/e.ts': "import { invoke } from '@tauri-apps/api/core';",
  }, (root) => {
    assert.deepEqual(collectRawIpc(root), ['app/src/a.ts', 'app/src/b.vue']);
  });
});

test('checkRawIpc passes baselined files and fails new ones', () => {
  assert.deepEqual(checkRawIpc(['app/src/a.ts'], ['app/src/a.ts', 'app/src/gone.ts']), []);
  assert.deepEqual(checkRawIpc(['app/src/a.ts', 'app/src/new.ts'], ['app/src/a.ts']), [
    '[arch:raw-ipc] app/src/new.ts imports @tauri-apps/api/core. New raw IPC is frozen: call it from an already-baselined file, or from app/src/platform/ once it exists (Wave 1). See app/arch/CLAUDE.md.',
  ]);
});
