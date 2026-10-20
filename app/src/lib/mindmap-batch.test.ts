import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAsOneOperation, type OperationBus } from './mindmap-batch.ts';

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
