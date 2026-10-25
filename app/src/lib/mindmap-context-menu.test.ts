// Exports under test: closingMenuItems (mindmap-context-menu.ts)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closingMenuItems, unselectedTopicAt } from './mindmap-context-menu.ts';

test('each item runs its action, then hides the menu', () => {
  const calls: string[] = [];
  const [item] = closingMenuItems([{ name: 'Mark', onclick: () => calls.push('action') }], () => calls.push('hide'));
  item.onclick();
  assert.deepEqual(calls, ['action', 'hide']);
});

test('the menu still hides when the action throws', () => {
  let isHidden = false;
  const [item] = closingMenuItems([{ name: 'Boom', onclick: () => { throw new Error('boom'); } }], () => { isHidden = true; });
  assert.throws(() => item.onclick());
  assert.equal(isHidden, true);
});

test('names are kept', () => {
  const items = closingMenuItems([{ name: 'A', onclick: () => {} }, { name: 'B', onclick: () => {} }], () => {});
  assert.deepEqual(items.map((i) => i.name), ['A', 'B']);
});

test('shortcut hints are kept', () => {
  const [item] = closingMenuItems([{ name: 'Follow', key: '⌥Enter', onclick: () => {} }], () => {});
  assert.equal(item.key, '⌥Enter');
});

function fakeTopic(isSelected: boolean): { classList: { contains(name: string): boolean } } {
  return { classList: { contains: (name) => isSelected && name === 'selected' } };
}

test('unselectedTopicAt finds the topic around an inner target', () => {
  const topic = fakeTopic(false);
  assert.equal(unselectedTopicAt({ closest: (sel) => (sel === 'me-tpc' ? topic : null) }), topic);
});

test('unselectedTopicAt keeps an existing selection and ignores the background', () => {
  assert.equal(unselectedTopicAt({ closest: () => fakeTopic(true) }), null);
  assert.equal(unselectedTopicAt({ closest: () => null }), null);
  assert.equal(unselectedTopicAt(null), null);
});
