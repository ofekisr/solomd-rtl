import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { AI_ACTIVITY_STALE_MS, applyAiActivity, dismissAiWarning, isAiWarningVisible, isAiWorking } from './ai-activity.ts';

test('a map is busy between active and inactive events', () => {
  applyAiActivity({ path: '/w/a.mmap', active: true });
  assert.equal(isAiWorking('/w/a.mmap'), true);
  assert.equal(isAiWorking('/w/b.mmap'), false);
  applyAiActivity({ path: '/w/a.mmap', active: false });
  assert.equal(isAiWorking('/w/a.mmap'), false);
});

test('a lock left behind by a dead server goes stale', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  applyAiActivity({ path: '/w/c.mmap', active: true });
  mock.timers.tick(AI_ACTIVITY_STALE_MS - 1);
  assert.equal(isAiWorking('/w/c.mmap'), true);
  applyAiActivity({ path: '/w/c.mmap', active: true });
  mock.timers.tick(AI_ACTIVITY_STALE_MS - 1);
  assert.equal(isAiWorking('/w/c.mmap'), true);
  mock.timers.tick(1);
  assert.equal(isAiWorking('/w/c.mmap'), false);
  mock.timers.reset();
});

test('untitled tabs are never busy', () => {
  assert.equal(isAiWorking(null), false);
  assert.equal(isAiWorking(undefined), false);
});

test('dismissing hides the warning until the next AI run', () => {
  applyAiActivity({ path: '/w/d.mmap', active: true });
  dismissAiWarning('/w/d.mmap');
  assert.equal(isAiWarningVisible('/w/d.mmap'), false);
  assert.equal(isAiWorking('/w/d.mmap'), true);
  applyAiActivity({ path: '/w/d.mmap', active: false });
  applyAiActivity({ path: '/w/d.mmap', active: true });
  assert.equal(isAiWarningVisible('/w/d.mmap'), true);
  applyAiActivity({ path: '/w/d.mmap', active: false });
});
