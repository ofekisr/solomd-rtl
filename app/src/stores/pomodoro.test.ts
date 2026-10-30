import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});

const persist = await import('./pomodoro-persist.ts');

test('last preset defaults to 25 and round-trips', () => {
  assert.equal(persist.getLastPreset(), 25);
  persist.setLastPreset(50);
  assert.equal(persist.getLastPreset(), 50);
  store.set('solomd.pomodoro.lastPreset.v1', '-3');
  assert.equal(persist.getLastPreset(), 25);
});

const sample = {
  phase: 'focus' as const,
  startedAt: Date.now(),
  durationMs: 1000,
  paused: false,
  pausedRemainingMs: 0,
  startWordCount: 0,
  priorFocusMode: false,
  autoBreakNext: true,
  notifyOnEnd: false,
};

test('persisted state round-trips and stale state is dropped', () => {
  assert.equal(persist.loadPersisted(), null);
  persist.savePersisted(sample);
  assert.deepEqual(persist.loadPersisted(), sample);
  persist.savePersisted({ ...sample, startedAt: Date.now() - 25 * 3600 * 1000 });
  assert.equal(persist.loadPersisted(), null);
  assert.equal(store.has('solomd.pomodoro.state.v1'), false);
  persist.savePersisted(sample);
  persist.clearPersisted();
  assert.equal(persist.loadPersisted(), null);
});

test('sessions append and todayIso formats', () => {
  persist.appendSession({ date: '2026-01-01', durationMin: 25, wordsWritten: 10 });
  persist.appendSession({ date: '2026-01-02', durationMin: 5, wordsWritten: 1 });
  assert.equal(JSON.parse(store.get('solomd.pomodoro.sessions.v1') ?? '[]').length, 2);
  assert.match(persist.todayIso(), /^\d{4}-\d{2}-\d{2}$/);
});
