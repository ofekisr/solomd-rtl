import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { buildIdMap, remapArrows, remapGates, remapSummaries } from './mindmap-paste-remap.ts';

const PASTED: NodeObj[] = [{ id: 'a', topic: 'A', children: [{ id: 'a1', topic: 'A1' }, { id: 'g', topic: 'gate', metadata: { gate: { target: 'a1' } } }] }];
const INSERTED: NodeObj[] = [{ id: 'X', topic: 'A', children: [{ id: 'Y', topic: 'A1' }, { id: 'Z', topic: 'gate', metadata: { gate: { target: 'a1' } } }] }];

test('buildIdMap pairs ids by tree position', () => {
  assert.deepEqual([...buildIdMap(PASTED, INSERTED)], [['a', 'X'], ['a1', 'Y'], ['g', 'Z']]);
});

test('remapGates points internal gates at new ids and leaves outside gates', () => {
  const inserted: NodeObj[] = structuredClone(INSERTED);
  inserted[0].children?.push({ id: 'W', topic: 'out', metadata: { gate: { target: 'elsewhere' } } });
  remapGates(inserted, buildIdMap(PASTED, INSERTED));
  assert.deepEqual(inserted[0].children?.[1].metadata, { gate: { target: 'Y' } });
  assert.deepEqual(inserted[0].children?.[2].metadata, { gate: { target: 'elsewhere' } });
});

test('remapArrows keeps only arrows inside the block, without ids', () => {
  const map = buildIdMap(PASTED, INSERTED);
  const out = remapArrows([{ id: '1', label: 'x', from: 'a', to: 'a1' }, { id: '2', label: '', from: 'a', to: 'outside' }], map);
  assert.deepEqual(out, [{ label: 'x', from: 'X', to: 'Y' }]);
});

test('remapSummaries keeps summaries whose parent is inside the block', () => {
  const map = buildIdMap(PASTED, INSERTED);
  assert.deepEqual(remapSummaries([{ id: 's', label: 'L', parent: 'a', start: 0, end: 1 }], map), [{ label: 'L', parent: 'X', start: 0, end: 1 }]);
});
