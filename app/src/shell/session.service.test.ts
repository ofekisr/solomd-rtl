import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSessionService, type SessionDeps } from './session.service.ts';

function makeDeps(overrides: Partial<SessionDeps> = {}): { deps: SessionDeps; calls: string[] } {
  const calls: string[] = [];
  const deps: SessionDeps = {
    persistTabs: () => calls.push('tabs.persist'),
    persistTiles: () => calls.push('tiles.persist'),
    syncTilesFromTabs: (id) => calls.push(`tiles.syncFromTabs:${id}`),
    validateTiles: () => calls.push('tiles.validate'),
    getFirstTabId: () => undefined,
    hasFocusedActiveTab: () => false,
    initDefaultTiles: (id) => calls.push(`tiles.initDefault:${id}`),
    syncActiveTab: () => calls.push('tiles.syncActiveTab'),
    ...overrides,
  };
  return { deps, calls };
}

test('persist() persists tabs then tiles', () => {
  const { deps, calls } = makeDeps();
  createSessionService(deps).persist();
  assert.deepEqual(calls, ['tabs.persist', 'tiles.persist']);
});

test('persistTiles() persists only tiles', () => {
  const { deps, calls } = makeDeps();
  createSessionService(deps).persistTiles();
  assert.deepEqual(calls, ['tiles.persist']);
});

test('syncTilesFromTabs() skips empty id and forwards a real one', () => {
  const { deps, calls } = makeDeps();
  const service = createSessionService(deps);
  service.syncTilesFromTabs(null);
  service.syncTilesFromTabs('');
  service.syncTilesFromTabs('t1');
  assert.deepEqual(calls, ['tiles.syncFromTabs:t1']);
});

test('initTiles() inits default when focused leaf empty and tabs exist', () => {
  const { deps, calls } = makeDeps({ getFirstTabId: () => 'a' });
  createSessionService(deps).initTiles();
  assert.deepEqual(calls, ['tiles.validate', 'tiles.initDefault:a', 'tiles.syncActiveTab']);
});

test('initTiles() skips default when leaf already has an active tab', () => {
  const { deps, calls } = makeDeps({ getFirstTabId: () => 'a', hasFocusedActiveTab: () => true });
  createSessionService(deps).initTiles();
  assert.deepEqual(calls, ['tiles.validate', 'tiles.syncActiveTab']);
});

test('initTiles() skips default when there are no tabs', () => {
  const { deps, calls } = makeDeps();
  createSessionService(deps).initTiles();
  assert.deepEqual(calls, ['tiles.validate', 'tiles.syncActiveTab']);
});
