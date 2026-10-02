import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { createLanguageExtension } from './editor-language';
import { bidiExtension } from './cm-bidi';

test('Python factory installs a whole-document parser', () => {
  const state = EditorState.create({
    doc: 'def greet():\n    return "Hello"',
    extensions: createLanguageExtension('python'),
  });
  assert.match(syntaxTree(state).toString(), /FunctionDefinition/);
});

test('Markdown factory keeps nested Python parsing', () => {
  const state = EditorState.create({
    doc: '```python\ndef greet():\n    return "Hello"\n```',
    extensions: createLanguageExtension('markdown'),
  });
  assert.match(syntaxTree(state).toString(), /FencedCode/);
  assert.equal(syntaxTree(state).resolveInner(state.doc.toString().indexOf('greet'), 1).name, 'VariableName');
});

test('Unknown language leaves text unparsed', () => {
  const state = EditorState.create({ extensions: createLanguageExtension('unknown') });
  assert.equal(syntaxTree(state).length, 0);
});

test('Code direction remains LTR when Hebrew comments dominate', () => {
  const state = EditorState.create({
    doc: '# הערה בעברית ארוכה מאוד שמסבירה את התוכנית\nx = 1',
    extensions: bidiExtension('ltr'),
  });
  const attributes = state.facet(EditorView.contentAttributes);
  const computed = attributes.map((value) => typeof value === 'function' ? value(state) : value);
  assert.equal(computed.find((value) => value.dir)?.dir, 'ltr');
});

test('Markdown direction continues to follow Hebrew prose', () => {
  const state = EditorState.create({ doc: 'שלום עולם', extensions: bidiExtension() });
  const attributes = state.facet(EditorView.contentAttributes);
  const computed = attributes.map((value) => typeof value === 'function' ? value(state) : value);
  assert.equal(computed.find((value) => value.dir)?.dir, 'rtl');
});

test('Reconfiguration changes parsers and direction without changing source', () => {
  const language = new Compartment();
  const direction = new Compartment();
  const doc = '# הערה בעברית ארוכה מאוד שמסבירה את התוכנית\ndef greet():\n    return 1';
  let state = EditorState.create({
    doc,
    extensions: [language.of(createLanguageExtension('plaintext')), direction.of(bidiExtension())],
  });
  state = state.update({ effects: [
    language.reconfigure(createLanguageExtension('python')),
    direction.reconfigure(bidiExtension('ltr')),
  ] }).state;
  assert.match(syntaxTree(state).toString(), /FunctionDefinition/);
  assert.equal(state.doc.toString(), doc);
  const attributes = state.facet(EditorView.contentAttributes);
  const computed = attributes.map((value) => typeof value === 'function' ? value(state) : value);
  assert.equal(computed.find((value) => value.dir)?.dir, 'ltr');
  state = state.update({ effects: language.reconfigure(createLanguageExtension('markdown')) }).state;
  assert.equal(syntaxTree(state).topNode.name, 'Document');
});
