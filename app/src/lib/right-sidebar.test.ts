import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RS_PANE_IDS, orderVisiblePanes, paneFlexStyle, type RsPaneVisibility } from './right-sidebar.ts';

function visibility(on: readonly string[]): RsPaneVisibility {
  return Object.fromEntries(RS_PANE_IDS.map((id) => [id, on.includes(id)])) as RsPaneVisibility;
}

test('orderVisiblePanes follows the saved order and drops hidden panes', () => {
  const order = orderVisiblePanes(['tags', 'outline', 'search'], visibility(['search', 'outline', 'tags']));
  assert.deepEqual(order, ['tags', 'outline', 'search']);
});

test('orderVisiblePanes appends panes missing from the saved order', () => {
  const order = orderVisiblePanes(['agent'], visibility(['agent', 'search', 'history']));
  assert.deepEqual(order, ['agent', 'search', 'history']);
});

test('orderVisiblePanes ignores unknown and duplicate ids', () => {
  const order = orderVisiblePanes(['bogus', 'tags', 'tags'], visibility(['tags', 'outline']));
  assert.deepEqual(order, ['tags', 'outline']);
});

test('orderVisiblePanes tolerates a missing saved order', () => {
  assert.deepEqual(orderVisiblePanes(undefined, visibility(['outline'])), ['outline']);
});

test('paneFlexStyle lets a lone pane fill the strip despite a stored height', () => {
  assert.deepEqual(paneFlexStyle(['outline'], { outline: 300 }, 'outline'), {});
});

test('paneFlexStyle keeps stylesheet shares when no height is stored', () => {
  assert.deepEqual(paneFlexStyle(['outline', 'agent'], {}, 'outline'), {});
});

test('paneFlexStyle pins stored heights and lets the bottom pane absorb the rest', () => {
  const panes = ['outline', 'backlinks', 'agent'] as const;
  const stored = { outline: 200 };
  assert.deepEqual(paneFlexStyle(panes, stored, 'outline'), {
    flex: '0 1 200px',
    height: '200px',
    minHeight: '80px',
  });
  assert.deepEqual(paneFlexStyle(panes, stored, 'backlinks'), {});
  assert.deepEqual(paneFlexStyle(panes, stored, 'agent'), { flex: '1 1 auto', minHeight: '80px' });
});
