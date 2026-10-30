import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const SOURCE = readFileSync(new URL('./FileTree.vue', import.meta.url), 'utf8');

// LLD S12: watchers and hooks register in the order the single component had them.
// selected + active-tab (220/221), workspace folder (476), filter (575/584),
// refresh hooks (651/664), reveal / follow-active / new-file (1112/1132/1150), window listeners (1522).
const WATCHER_ORDER = [
  'useTreeSelection(',
  'useTreeSort(',
  'useTreeLoad(',
  'useTreeFilter(',
  'useTreeRefresh(',
  'useTreeRevealRow(',
  'useTreeWindowKeys(',
];

test('FileTree.vue calls the watcher-registering composables in S12 order', () => {
  const positions = WATCHER_ORDER.map((call) => {
    const at = SOURCE.indexOf(`= ${call}`) >= 0 ? SOURCE.indexOf(`= ${call}`) : SOURCE.indexOf(`\n${call}`);
    assert.ok(at >= 0, `${call} is called in FileTree.vue`);
    return at;
  });
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test('edit, move and drag composables run before the reveal watchers', () => {
  const edit = SOURCE.indexOf('= useTreeEdit(');
  const drag = SOURCE.indexOf('= useTreeDragDrop(');
  const reveal = SOURCE.indexOf('useTreeRevealRow(');
  assert.ok(edit >= 0 && drag > edit && reveal > drag);
});
