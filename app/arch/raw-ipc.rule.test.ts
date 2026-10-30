import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withFixtureTree } from './fixture-tree.ts';
import { checkRawIpc, collectRawIpc } from './raw-ipc.rule.ts';

test('collectRawIpc finds any @tauri-apps/* import in app/src outside platform/', () => {
  withFixtureTree({
    'app/src/a.ts': "import { invoke } from '@tauri-apps/api/core';",
    'app/src/b.vue': "<script setup lang=\"ts\">\nconst { invoke } = await import('@tauri-apps/api/core');\n</script>",
    'app/src/c.ts': "import { open } from '@tauri-apps/plugin-dialog';",
    'app/src/d.test.ts': "import { invoke } from '@tauri-apps/api/core';",
    'app/src/platform/ipc/x.tauri.adapter.ts': "import { invoke } from '@tauri-apps/api/core';",
    'mcp-mindmap/src/e.ts': "import { invoke } from '@tauri-apps/api/core';",
  }, (root) => {
    assert.deepEqual(collectRawIpc(root), ['app/src/a.ts', 'app/src/b.vue', 'app/src/c.ts']);
  });
});

test('checkRawIpc passes baselined files and fails new ones', () => {
  assert.deepEqual(checkRawIpc(['app/src/a.ts'], ['app/src/a.ts', 'app/src/gone.ts']), []);
  assert.deepEqual(checkRawIpc(['app/src/a.ts', 'app/src/new.ts'], ['app/src/a.ts']), [
    '[arch:raw-ipc] app/src/new.ts imports @tauri-apps/*. Only app/src/platform/ may import Tauri: call a port from app/src/platform/index.ts instead. See app/src/platform/CLAUDE.md.',
  ]);
});
