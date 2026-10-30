import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { buildDecorations } from './cm-live-decorations.ts';
import { codeBlockClipboardText, listItemHasTask, LIVE_EDIT_CLASSES } from './cm-live-render.ts';

const SYNTAX_TIMEOUT_MS = 5000;
const GOLDEN = new URL('./cm-live-render.golden.json', import.meta.url);

const DOC = [
  '# Heading **bold**',
  '',
  'Text *em* ~~gone~~ `code` [lbl](http://x.y "t") <http://auto.link>',
  'Inline <strong>html</strong> and ==mark== and <kbd>k</kbd>',
  'H <sub>2</sub> x<sup>3</sup> <u>under</u>',
  '',
  '## H2',
  '### H3',
  '#### H4',
  '##### H5',
  '###### H6',
  '',
  '> quote line',
  '> more',
  '',
  '- bullet',
  '- [ ] task',
  '1. ordered',
  '',
  '---',
  '',
  '```ts',
  'const a = 1;',
  '```',
  '',
  '```mermaid',
  'graph TD',
  '```',
  '',
  '    indented code',
  '',
  'Setext',
  '======',
].join('\n');

function fakeView(state: EditorState): EditorView {
  return { state, visibleRanges: [{ from: 0, to: state.doc.length }] } as unknown as EditorView;
}

function withFullTree(initial: EditorState): EditorState {
  const tree = ensureSyntaxTree(initial, initial.doc.length, SYNTAX_TIMEOUT_MS);
  assert.ok(tree, 'full parse completed');
  const state = initial.update({}).state;
  const expected = markdownLanguage.parser.parse(state.doc.toString());
  assert.equal(syntaxTree(state).topNode.lastChild?.to, expected.topNode.lastChild?.to, 'state carries the full tree');
  return state;
}

function describeSet(initial: EditorState, showMarkers: boolean): unknown[] {
  const state = withFullTree(initial);
  const set = buildDecorations(fakeView(state), showMarkers);
  const out: unknown[] = [];
  const cursor = set.iter();
  while (cursor.value) {
    const spec = cursor.value.spec as { class?: string; widget?: { constructor: { name: string } } };
    out.push([cursor.from, cursor.to, spec.class ?? null, spec.widget?.constructor.name ?? null, cursor.value.point ? 'point' : 'range']);
    cursor.next();
  }
  return out;
}

function snapshot(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const caret of [0, 40, DOC.indexOf('- [ ]'), DOC.indexOf('const'), DOC.length]) {
    const state = EditorState.create({ doc: DOC, selection: { anchor: caret }, extensions: [markdown({ base: markdownLanguage })] });
    out[`caret${caret}`] = describeSet(state, false);
    out[`caret${caret}:markers`] = describeSet(state, true);
  }
  const doc = EditorState.create({ doc: '  ```py\n  a\n    b\n  ```\n\n    x\n    y\n```terminal\n$ ls\n```' }).doc;
  out.clip = [
    codeBlockClipboardText(doc, true, 1, 4),
    codeBlockClipboardText(doc, false, 6, 7),
    codeBlockClipboardText(doc, true, 8, 10),
  ];
  out.classes = [...LIVE_EDIT_CLASSES];
  out.hasTask = typeof listItemHasTask;
  return out;
}

test('cm-live-render decorations match golden snapshot', () => {
  const actual = JSON.parse(JSON.stringify(snapshot()));
  if (!existsSync(GOLDEN)) writeFileSync(GOLDEN, JSON.stringify(actual));
  assert.deepEqual(actual, JSON.parse(readFileSync(GOLDEN, 'utf8')));
});
