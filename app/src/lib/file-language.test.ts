import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inferFileLanguage, untitledFileName } from './file-language.ts';

test('Recognizes filenames and paths rather than bare language names', () => {
  assert.equal(inferFileLanguage('example.py'), 'python');
  assert.equal(inferFileLanguage('example.pyj'), 'python');
  assert.equal(inferFileLanguage('/workspace/EXAMPLE.PYJ'), 'python');
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

test('Shell extensions and startup files select the shared Bash highlighter', () => {
  for (const name of [
    'script.sh', 'script.bash', 'script.zsh', 'script.shell', 'SCRIPT.SH',
    '.bashrc', '.bash_profile', '.bash_login', '.bash_logout', '.profile',
    '.zshrc', '.zshenv', '.zprofile', '.zlogin', '.zlogout', '/home/user/.zshrc',
  ]) {
    assert.equal(inferFileLanguage(name), 'bash', name);
  }
});

test('mindmap files route to the mindmap language', () => {
  assert.equal(inferFileLanguage('/maps/Plan.mmap'), 'mindmap');
  assert.equal(inferFileLanguage('C:\\maps\\PLAN.MMAP'), 'mindmap');
  assert.equal(inferFileLanguage('/maps/Old.xmind'), 'mindmap');
});

test('untitled names follow the language', () => {
  assert.equal(untitledFileName('markdown'), 'Untitled.md');
  assert.equal(untitledFileName('mindmap'), 'Untitled.mmap');
  assert.equal(untitledFileName('plaintext'), 'Untitled.txt');
  assert.equal(untitledFileName('python'), 'Untitled.txt');
});

test('Selects the parser for JS/TS ecosystem files', () => {
  const cases = {
    mts: 'typescript', cts: 'typescript', jsonc: 'json',
    vue: 'vue', svelte: 'svelte', scss: 'scss', less: 'less', sass: 'sass',
  };
  for (const [extension, language] of Object.entries(cases)) {
    assert.equal(inferFileLanguage(`example.${extension}`), language);
  }
});
