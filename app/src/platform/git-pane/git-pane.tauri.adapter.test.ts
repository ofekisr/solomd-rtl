import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GitPaneError } from '../../lib/git-pane/service.ts';
import type { PlatformEvent, UnlistenFn } from '../events/events.port.ts';
import { createTauriGitPaneService } from './git-pane.tauri.adapter.ts';

type Call = { command: string; args?: Record<string, unknown> };

function fakeListen(): () => Promise<UnlistenFn> {
  return () => Promise.resolve(() => {});
}

function recordingInvoke(result: unknown): { calls: Call[]; invoke: (c: string, a?: Record<string, unknown>) => Promise<unknown> } {
  const calls: Call[] = [];
  return {
    calls,
    invoke: (command, args) => {
      calls.push({ command, args });
      return Promise.resolve(result);
    },
  };
}

const SNAPSHOT = {
  repository: { currentBranch: 'main' },
  commits: [],
  branches: [],
  tags: [],
  page: {},
  workingTree: [],
};

test('version forwards gitpane_version and returns the result', async () => {
  const { calls, invoke } = recordingInvoke({ version: '2.40' });
  const service = createTauriGitPaneService(invoke, fakeListen());
  assert.deepEqual(await service.version(), { version: '2.40' });
  assert.deepEqual(calls, [{ command: 'gitpane_version', args: undefined }]);
});

test('version returns null when invoke rejects', async () => {
  const service = createTauriGitPaneService(() => Promise.reject(new Error('no git')), fakeListen());
  assert.equal(await service.version(), null);
});

test('open forwards path, options and trusted', async () => {
  const { calls, invoke } = recordingInvoke({ ok: true, snapshot: SNAPSHOT });
  const service = createTauriGitPaneService(invoke, fakeListen());
  await service.open('/repo', true);
  assert.deepEqual(calls, [
    { command: 'gitpane_open', args: { path: '/repo', options: { commitLimit: 200 }, trusted: true } },
  ]);
});

test('a rejected invoke surfaces through toGitPaneError unchanged', async () => {
  const original = new GitPaneError('not_a_repo', 'nope');
  const payload = { __gitError: true, code: 'untrusted', message: 'blocked' };
  const byInstance = createTauriGitPaneService(() => Promise.reject(original), fakeListen());
  const byPayload = createTauriGitPaneService(() => Promise.reject(payload), fakeListen());
  await assert.rejects(byInstance.open('/repo', false), (e: unknown) => e === original);
  await assert.rejects(
    byPayload.open('/repo', false),
    (e: unknown) => e instanceof GitPaneError && e.code === 'untrusted' && e.message === 'blocked',
  );
});

test('onChanged listens on gitpane:changed and unlistens after dispose', async () => {
  let unlistenCalls = 0;
  const events: string[] = [];
  const listen = <T>(event: string, _h: (e: PlatformEvent<T>) => void): Promise<UnlistenFn> => {
    events.push(event);
    return Promise.resolve(() => {
      unlistenCalls += 1;
    });
  };
  const service = createTauriGitPaneService(() => Promise.resolve(null), listen);
  const dispose = service.onChanged(() => {});
  dispose();
  await Promise.resolve();
  assert.deepEqual(events, ['gitpane:changed']);
  assert.equal(unlistenCalls, 1);
});
