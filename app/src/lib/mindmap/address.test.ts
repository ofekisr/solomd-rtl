import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { boundSession, describeNode, outlineOf, pathOf, resolveNode } from './address.ts';

const SID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const root = (): NodeObj => ({ id: 'r', topic: 'Root', children: [
  { id: 'a', topic: 'Phase 2', tags: ['api'], metadata: { mark: 'blocked', fields: [{ key: 'claude-session', value: SID }] }, children: [
    { id: 'a1', topic: 'Design' }, { id: 'a2', topic: 'Tasks', children: [{ id: 't1', topic: 'T1' }] },
  ] },
  { id: 'g', topic: '⇒ Design', metadata: { gate: { target: 'a1' } } },
] });

test('resolveNode by id, by path, and reports misses', () => {
  assert.equal(resolveNode(root(), 'a1').ok && 'found', 'found');
  const byPath = resolveNode(root(), 'root/phase 2/design');
  assert.ok(byPath.ok && byPath.node.id === 'a1');
  const miss = resolveNode(root(), 'Root/Nope');
  assert.ok(!miss.ok && miss.error.includes('Nope'));
});

test('pathOf and boundSession', () => {
  assert.equal(pathOf(root(), 't1'), 'Root/Phase 2/Tasks/T1');
  assert.equal(boundSession(root().children![0]), SID);
  assert.equal(boundSession(root()), null);
});

test('outlineOf shows ids, marks, sessions, tags, gates and cut counts', () => {
  const text = outlineOf(root(), undefined, 2);
  assert.equal(text, [
    '- Root [^r]',
    '  - Phase 2 [^a] #api {mark: blocked} {session}',
    '    - Design [^a1]',
    '    - Tasks [^a2] (+1)',
    '  - ⇒ Design [^g] → [^a1]',
  ].join('\n'));
});

test('describeNode lists gates pointing in', () => {
  const s = describeNode(root(), 'a1')!;
  assert.deepEqual(s.gatesIn, ['g']);
  assert.equal(s.path, 'Root/Phase 2/Design');
  assert.equal(describeNode(root(), 'zz'), null);
});
