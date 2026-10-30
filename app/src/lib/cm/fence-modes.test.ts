import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { fenceModeField, setFenceMode } from './fence-modes.ts';

const DOC = 'intro\n\n```dot\ndigraph { a -> b }\n```\n';
const FENCE_FROM = DOC.indexOf('```dot');

function withSplitMode(): EditorState {
  const state = EditorState.create({ doc: DOC, extensions: [fenceModeField] });
  return state.update({ effects: setFenceMode.of({ from: FENCE_FROM, mode: 'split' }) }).state;
}

test('a picked mode follows its block when text is inserted above', () => {
  const state = withSplitMode().update({ changes: { from: 0, insert: 'more\n' } }).state;
  assert.equal(state.field(fenceModeField).get(FENCE_FROM + 5), 'split');
});

test('a picked mode survives a whole-document replace (pane sync)', () => {
  const start = withSplitMode();
  const synced = DOC.replace('a -> b', 'a -> b -> c');
  const state = start.update({ changes: { from: 0, to: start.doc.length, insert: synced } }).state;
  assert.equal(state.field(fenceModeField).get(FENCE_FROM), 'split');
});
