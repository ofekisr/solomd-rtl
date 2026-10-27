import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAiActivity,
  configureAiActivity,
  expandAiWarning,
  isAiWarningMinimized,
  isAiWorking,
  keepAiWarningMinimizedForTab,
  minimizeAiWarning,
} from './ai-activity.ts';

const RELEASE_MS = 2_000;
const STALE_MS = 60_000;

beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout'] });
  configureAiActivity({ releaseDelayMs: RELEASE_MS, staleMs: STALE_MS });
});
afterEach(() => mock.timers.reset());

const enter = (path: string, holder = 'h1') => applyAiActivity({ path, holder, active: true });
const leave = (path: string, holder = 'h1') => applyAiActivity({ path, holder, active: false });

test('a file stays busy for the release delay after its last holder leaves', () => {
  enter('/w/a.md');
  assert.equal(isAiWorking('/w/b.md'), false);
  leave('/w/a.md');
  mock.timers.tick(RELEASE_MS - 1);
  assert.equal(isAiWorking('/w/a.md'), true);
  mock.timers.tick(1);
  assert.equal(isAiWorking('/w/a.md'), false);
});

test('a file stays busy until every holder leaves', () => {
  enter('/w/c.md', 'h1');
  enter('/w/c.md', 'h2');
  leave('/w/c.md', 'h1');
  mock.timers.tick(RELEASE_MS);
  assert.equal(isAiWorking('/w/c.md'), true);
  leave('/w/c.md', 'h2');
  mock.timers.tick(RELEASE_MS);
  assert.equal(isAiWorking('/w/c.md'), false);
});

test('a holder coming back during the release delay keeps the file busy', () => {
  enter('/w/d.md');
  leave('/w/d.md');
  mock.timers.tick(RELEASE_MS - 1);
  enter('/w/d.md');
  mock.timers.tick(RELEASE_MS);
  assert.equal(isAiWorking('/w/d.md'), true);
  leave('/w/d.md');
  mock.timers.tick(RELEASE_MS);
});

test('a holder that stops refreshing goes stale', () => {
  enter('/w/e.md');
  mock.timers.tick(STALE_MS - 1);
  enter('/w/e.md');
  mock.timers.tick(STALE_MS - 1);
  assert.equal(isAiWorking('/w/e.md'), true);
  mock.timers.tick(1);
  mock.timers.tick(RELEASE_MS);
  assert.equal(isAiWorking('/w/e.md'), false);
});

test('an old marker found on open counts only for the rest of its stale window', () => {
  applyAiActivity({ path: '/w/h.md', holder: 'h1', active: true, ageMs: STALE_MS });
  assert.equal(isAiWorking('/w/h.md'), false);
  applyAiActivity({ path: '/w/h.md', holder: 'h1', active: true, ageMs: STALE_MS - 10 });
  mock.timers.tick(10);
  mock.timers.tick(RELEASE_MS);
  assert.equal(isAiWorking('/w/h.md'), false);
});

test('a zero release delay unlocks at once; unknown holders are ignored', () => {
  configureAiActivity({ releaseDelayMs: 0 });
  enter('/w/f.md');
  leave('/w/f.md', 'stranger');
  assert.equal(isAiWorking('/w/f.md'), true);
  leave('/w/f.md');
  assert.equal(isAiWorking('/w/f.md'), false);
  assert.equal(isAiWorking(null), false);
});

test('minimize lasts one busy period; keep-for-tab and always outlast it', () => {
  const scope = { path: '/w/g.md', tabId: 't1', alwaysMinimized: false };
  enter('/w/g.md');
  minimizeAiWarning('/w/g.md');
  assert.equal(isAiWarningMinimized(scope), true);
  leave('/w/g.md');
  mock.timers.tick(RELEASE_MS);
  enter('/w/g.md');
  assert.equal(isAiWarningMinimized(scope), false);
  keepAiWarningMinimizedForTab('/w/g.md', 't1');
  leave('/w/g.md');
  mock.timers.tick(RELEASE_MS);
  enter('/w/g.md');
  assert.equal(isAiWarningMinimized(scope), true);
  assert.equal(isAiWarningMinimized({ ...scope, tabId: 't2' }), false);
  assert.equal(isAiWarningMinimized({ ...scope, tabId: 't2', alwaysMinimized: true }), true);
  expandAiWarning('/w/g.md', 't1');
  assert.equal(isAiWarningMinimized({ ...scope, alwaysMinimized: true }), false);
  leave('/w/g.md');
  mock.timers.tick(RELEASE_MS);
});
