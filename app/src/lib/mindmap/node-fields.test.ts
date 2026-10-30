import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { FIELDS_MAX, fieldAction, fieldsPatch, nodePath, notePatch, readFields, sanitizeMetadata } from './node-fields.ts';

const SESSION = '3f2b9c1e-8d4a-4b6e-9f0a-1c2d3e4f5a6b';

test('readFields returns an empty list when metadata is missing or malformed', () => {
  assert.deepEqual(readFields({ id: 'a', topic: 'A' }), []);
  assert.deepEqual(readFields({ id: 'a', topic: 'A', metadata: { fields: 'nope' } }), []);
});

test('sanitizeMetadata drops invalid entries, strips angle brackets and keeps foreign keys', () => {
  const metadata = sanitizeMetadata({ other: 1, fields: [{ key: '<b>owner</b>', value: 'me' }, { key: '', value: 'x' }, { key: 3, value: 'y' }] });
  assert.deepEqual(metadata, { other: 1, fields: [{ key: 'bowner/b', value: 'me' }] });
});

test('sanitizeMetadata caps the number of fields', () => {
  const fields = Array.from({ length: FIELDS_MAX + 5 }, (_, i) => ({ key: `k${i}`, value: 'v' }));
  assert.equal((sanitizeMetadata({ fields })?.fields as unknown[]).length, FIELDS_MAX);
});

test('sanitizeMetadata returns undefined for empty or non-object metadata', () => {
  assert.equal(sanitizeMetadata({ fields: [] }), undefined);
  assert.equal(sanitizeMetadata('x'), undefined);
});

test('fieldsPatch merges into existing metadata and clears when empty', () => {
  const node: NodeObj = { id: 'a', topic: 'A', metadata: { other: true } };
  assert.deepEqual(fieldsPatch(node, [{ key: 'status', value: 'done' }]), { metadata: { other: true, fields: [{ key: 'status', value: 'done' }] } });
  assert.deepEqual(fieldsPatch({ id: 'b', topic: 'B' }, []), { metadata: undefined });
});

test('notePatch clears whitespace-only notes', () => {
  assert.deepEqual(notePatch('  \n'), { note: undefined });
  assert.deepEqual(notePatch('# hi'), { note: '# hi' });
});

test('claude-session with a session id yields a resume command', () => {
  assert.deepEqual(fieldAction({ key: 'claude-session', value: ` ${SESSION} ` }), { kind: 'claudeResume', command: `claude --resume ${SESSION}` });
  assert.deepEqual(fieldAction({ key: 'claude-session', value: 'not-an-id; rm -rf /' }), { kind: 'none' });
});

test('web links are actionable, other schemes are not', () => {
  assert.deepEqual(fieldAction({ key: 'pr', value: 'https://github.com/x/y/pull/1' }), { kind: 'link', url: 'https://github.com/x/y/pull/1' });
  assert.deepEqual(fieldAction({ key: 'pr', value: 'javascript:alert(1)' }), { kind: 'none' });
});

test('nodePath lists ancestor topics from the root down', () => {
  const root: NodeObj = { id: 'r', topic: 'Root' };
  const mid: NodeObj = { id: 'm', topic: 'Mid', parent: root };
  assert.deepEqual(nodePath({ id: 'l', topic: 'Leaf', parent: mid }), ['Root', 'Mid']);
});
