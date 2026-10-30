import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { slashCommandsExtension, slashStateField } from './cm-slash-commands.ts';
import { setSlashState, isTriggerPosition, isInsideCodeContext } from './cm-slash-state.ts';

const SYNTAX_TIMEOUT_MS = 5000;
const GOLDEN = new URL('./cm-slash-commands.golden.json', import.meta.url);

function makeState(doc: string, anchor: number): EditorState {
  const state = EditorState.create({
    doc,
    selection: { anchor },
    extensions: [markdown({ base: markdownLanguage }), slashCommandsExtension({ enabled: () => true })],
  });
  assert.ok(ensureSyntaxTree(state, state.doc.length, SYNTAX_TIMEOUT_MS), 'full parse completed');
  return state.update({}).state;
}

function snapshot(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const doc = 'a /b\n```\nx /y\n```\n`c /d` /\n\n/head';
  out.trigger = Array.from({ length: doc.length + 1 }, (_v, i) => isTriggerPosition(makeState(doc, 0), i));
  out.code = Array.from({ length: doc.length + 1 }, (_v, i) => isInsideCodeContext(makeState(doc, 0), i));
  let st = makeState('hello /fo', 9);
  st = st.update({ effects: setSlashState.of({ triggerPos: 6, end: 9, query: 'fo', selectedIndex: 2 }) }).state;
  out.opened = st.field(slashStateField);
  const typed = st.update({ changes: { from: 9, insert: 'o' }, selection: { anchor: 10 } }).state;
  out.typed = typed.field(slashStateField);
  out.typedSpace = typed.update({ changes: { from: 10, insert: ' ' }, selection: { anchor: 11 } }).state.field(slashStateField);
  out.removedSlash = typed.update({ changes: { from: 6, to: 7 }, selection: { anchor: 8 } }).state.field(slashStateField);
  out.movedBefore = typed.update({ selection: { anchor: 3 } }).state.field(slashStateField);
  out.movedEnd = st.update({ selection: { anchor: 8 } }).state.field(slashStateField);
  out.movedNewline = makeState('a /b\nzz', 0)
    .update({ effects: setSlashState.of({ triggerPos: 2, end: 3, query: '', selectedIndex: 0 }) })
    .state.update({ selection: { anchor: 6 } }).state.field(slashStateField);
  out.cleared = st.update({ effects: setSlashState.of(null) }).state.field(slashStateField);
  return out;
}

test('cm-slash-commands state logic matches golden snapshot', () => {
  const actual = JSON.parse(JSON.stringify(snapshot()));
  if (!existsSync(GOLDEN)) writeFileSync(GOLDEN, JSON.stringify(actual));
  assert.deepEqual(actual, JSON.parse(readFileSync(GOLDEN, 'utf8')));
});
