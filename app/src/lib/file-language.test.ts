import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inferFileLanguage } from './file-language';

test('Recognizes filenames and paths rather than bare language names', () => {
  assert.equal(inferFileLanguage('example.py'), 'python');
  assert.equal(inferFileLanguage('/workspace/scripts/EXAMPLE.PY'), 'python');
  assert.equal(inferFileLanguage('C:\\scripts\\example.py'), 'python');
  assert.equal(inferFileLanguage('notes.full.md'), 'markdown');
});

test('Selects the correct parser for each supported code extension', () => {
  const cases = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript', py: 'python', rs: 'rust',
    html: 'html', htm: 'html', css: 'css', json: 'json', java: 'java',
    yaml: 'yaml', yml: 'yaml', xml: 'xml', c: 'cpp', cpp: 'cpp',
    h: 'cpp', hpp: 'cpp', cc: 'cpp', go: 'go', sql: 'sql',
  };
  for (const [extension, language] of Object.entries(cases)) {
    assert.equal(inferFileLanguage(`example.${extension}`), language);
  }
});

test('Unknown and extensionless files remain plaintext', () => {
  for (const name of ['example.txt', 'example.unknown', 'python', '.py', '/folder.py/README']) {
    assert.equal(inferFileLanguage(name), 'plaintext');
  }
});
