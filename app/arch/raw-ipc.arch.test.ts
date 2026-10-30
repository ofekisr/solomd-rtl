import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadBaseline } from './baseline-file.ts';
import { checkRawIpc, collectRawIpc } from './raw-ipc.rule.ts';
import { REPO_ROOT } from './scan.ts';

test('no new file imports @tauri-apps/api/core', () => {
  const failures = checkRawIpc(collectRawIpc(REPO_ROOT), loadBaseline().rawIpc);
  assert.deepEqual(failures, [], failures.join('\n'));
});
