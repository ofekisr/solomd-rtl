import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUpdatesService, type UpdatesDeps, type UpdateCheckResult } from './updates.service.ts';

const TOAST_TIMEOUT_MS = 12000;

interface ToastCall { message: string; timeout: number; onClick: () => void }

function makeDeps(result: UpdateCheckResult | null, overrides: Partial<UpdatesDeps> = {}) {
  const toasts: ToastCall[] = [];
  const opened: string[] = [];
  const deps: UpdatesDeps = {
    isAutoCheckEnabled: () => true,
    checkForUpdateOnStartup: async () => result,
    openReleaseUrl: async (url) => { opened.push(url); },
    showToast: (message, timeout, onClick) => { toasts.push({ message, timeout, onClick }); },
    t: (key, params) => `${key}:${params?.version ?? ''}`,
    ...overrides,
  };
  return { deps, toasts, opened };
}

test('shows toast with version when update available; click opens release url', async () => {
  const { deps, toasts, opened } = makeDeps({ hasUpdate: true, latest: '1.2.3', url: 'https://x/r' });
  await createUpdatesService(deps).start();
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].message, 'settings.updateAvailable:1.2.3');
  assert.equal(toasts[0].timeout, TOAST_TIMEOUT_MS);
  toasts[0].onClick();
  assert.deepEqual(opened, ['https://x/r']);
});

test('uses empty version when latest is null', async () => {
  const { deps, toasts } = makeDeps({ hasUpdate: true, latest: null, url: 'u' });
  await createUpdatesService(deps).start();
  assert.equal(toasts[0].message, 'settings.updateAvailable:');
});

test('no toast when no update or null result', async () => {
  const a = makeDeps({ hasUpdate: false, latest: '1', url: 'u' });
  await createUpdatesService(a.deps).start();
  const b = makeDeps(null);
  await createUpdatesService(b.deps).start();
  assert.equal(a.toasts.length + b.toasts.length, 0);
});

test('does nothing when auto check disabled', async () => {
  let checked = false;
  const { deps, toasts } = makeDeps(null, {
    isAutoCheckEnabled: () => false,
    checkForUpdateOnStartup: async () => { checked = true; return null; },
  });
  await createUpdatesService(deps).start();
  assert.equal(checked, false);
  assert.equal(toasts.length, 0);
});

test('swallows check errors silently', async () => {
  const { deps, toasts } = makeDeps(null, {
    checkForUpdateOnStartup: async () => { throw new Error('boom'); },
  });
  await createUpdatesService(deps).start();
  assert.equal(toasts.length, 0);
});

test('swallows a failing (lazy-loading) toast inside the silent try', async () => {
  const { deps } = makeDeps({ hasUpdate: true, latest: '1', url: 'u' }, {
    showToast: async () => { throw new Error('chunk load failed'); },
  });
  await assert.doesNotReject(createUpdatesService(deps).start());
});

test('skips the update check on iOS', async () => {
  let checked = false;
  const { deps, toasts } = makeDeps({ hasUpdate: true, latest: '1', url: 'u' }, {
    isIOS: () => true,
    checkForUpdateOnStartup: async () => { checked = true; return null; },
  });
  await createUpdatesService(deps).start();
  assert.equal(checked, false);
  assert.equal(toasts.length, 0);
});
