import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { classHighlighter, highlightTree } from '@lezer/highlight';
import { createLanguageExtension, loadLanguageExtension } from './editor-language.ts';
import { bidiExtension } from './cm-bidi.ts';

test('Shell source and each fence alias highlight keywords, strings and comments', () => {
  const source = 'if true; then\n  echo "Hello" # greeting\nfi';
  const cases = [
    { doc: source, language: 'bash' },
    ...['bash', 'sh', 'zsh', 'shell'].map((alias) => ({
      doc: `\`\`\`${alias}\n${source}\n\`\`\``, language: 'markdown',
    })),
  ];
  for (const { doc, language } of cases) {
    const state = EditorState.create({ doc, extensions: createLanguageExtension(language) });
    const classes: string[] = [];
    highlightTree(syntaxTree(state), classHighlighter, (_from, _to, value) => classes.push(value));
    const highlighted = classes.join(' ');
    assert.match(highlighted, /tok-keyword/, doc);
    assert.match(highlighted, /tok-string/, doc);
    assert.match(highlighted, /tok-comment/, doc);
  }
});

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

test('Vue file loads its lazy grammar and highlights script and template', async () => {
  const doc = '<template>\n  <div class="a">{{ msg }}</div>\n</template>\n<script setup lang="ts">\nconst msg: string = "hi";\n</script>';
  assert.deepEqual(createLanguageExtension('vue'), []);
  const support = await loadLanguageExtension('vue');
  assert.ok(support);
  const state = EditorState.create({ doc, extensions: support });
  const classes: string[] = [];
  highlightTree(syntaxTree(state), classHighlighter, (_from, _to, value) => classes.push(value));
  const highlighted = classes.join(' ');
  assert.match(highlighted, /tok-typeName/);
  assert.match(highlighted, /tok-keyword/);
  assert.match(highlighted, /tok-string/);
  assert.equal(loadLanguageExtension('vue'), null);
  assert.equal(loadLanguageExtension('typescript'), null);
});
