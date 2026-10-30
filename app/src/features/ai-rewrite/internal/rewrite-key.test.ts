import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorView } from '@codemirror/view';
import { stateWith } from '../../editor/internal/cm-probe.ts';
import { aiLockExtension, currentAiRewriteKey, UNBOUND_CM_KEY } from './rewrite-key.ts';

test('default chord maps to CodeMirror spelling', () => {
  assert.equal(currentAiRewriteKey({}), 'Mod-j');
});

test('a rebind is used', () => {
  assert.equal(currentAiRewriteKey({ 'editor.aiRewrite': 'Alt+K' }), 'Alt-k');
});

test('unbound action yields F24', () => {
  assert.equal(UNBOUND_CM_KEY, 'F24');
  assert.equal(currentAiRewriteKey({ 'editor.aiRewrite': null }), 'F24');
});

test('aiLockExtension(true) makes the state read-only and non-editable', () => {
  const state = stateWith(aiLockExtension(true));
  assert.equal(state.readOnly, true);
  assert.equal(state.facet(EditorView.editable), false);
});

test('aiLockExtension(false) leaves defaults', () => {
  const state = stateWith(aiLockExtension(false));
  assert.equal(state.readOnly, false);
  assert.equal(state.facet(EditorView.editable), true);
});
