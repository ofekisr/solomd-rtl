import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAsOneOperation, runAsOneOperationAsync, type OperationBus } from './batch.ts';

function recordingBus(): OperationBus & { log: string[] } {
  const log: string[] = [];
  return { log, fire(name: string, payload?: unknown) { log.push(`${name}:${(payload as { name?: string })?.name ?? ''}`); } };
}

test('collapses inner operations into one event', () => {
  const bus = recordingBus();
  runAsOneOperation(bus, () => { bus.fire('operation', { name: 'reshapeNode' }); bus.fire('operation', { name: 'reshapeNode' }); return true; }, { name: 'reshapeNodes' });
  assert.deepEqual(bus.log, ['operation:reshapeNodes']);
});

test('passes through non-operation events', () => {
  const bus = recordingBus();
  runAsOneOperation(bus, () => { bus.fire('selectNodes'); return true; }, { name: 'reshapeNodes' });
  assert.deepEqual(bus.log, ['selectNodes:', 'operation:reshapeNodes']);
});

test('fires nothing when no work was done and restores fire', () => {
  const bus = recordingBus();
  const original = bus.fire;
  runAsOneOperation(bus, () => false, { name: 'reshapeNodes' });
  assert.deepEqual(bus.log, []);
  assert.equal(bus.fire, original);
});

test('runAsOneOperationAsync emits exactly one operation for many inner ones', async () => {
  const fired: string[] = [];
  const bus = { fire: (name: string) => { fired.push(name); } };
  await runAsOneOperationAsync(bus, async () => {
    bus.fire('operation'); await Promise.resolve(); bus.fire('operation');
    return true;
  }, { name: 'pasteMap' });
  assert.deepEqual(fired, ['operation']);
});

test('runAsOneOperationAsync restores fire when work throws', async () => {
  const original = () => {};
  const bus = { fire: original };
  await assert.rejects(runAsOneOperationAsync(bus, async () => { throw new Error('x'); }, {}));
  assert.equal(bus.fire, original);
});

test('runAsOneOperationAsync forwards the event filled in by work', async () => {
  const events: unknown[] = [];
  const bus = { fire: (_name: string, payload?: unknown) => { events.push(payload); } };
  const event: Record<string, unknown> = { name: 'copyNodes' };
  await runAsOneOperationAsync(bus, async () => { event.objs = ['a']; return true; }, event);
  assert.deepEqual(events, [{ name: 'copyNodes', objs: ['a'] }]);
  assert.equal(events[0], event);
});
