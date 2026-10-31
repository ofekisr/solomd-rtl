import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRelativePath } from './preview-links.ts';

test('posix sibling, ./ and ../', () => {
  assert.equal(resolveRelativePath('/a/b/c.md', 'd.md'), '/a/b/d.md');
  assert.equal(resolveRelativePath('/a/b/c.md', './x/y.md'), '/a/b/x/y.md');
  assert.equal(resolveRelativePath('/a/b/c.md', '../d.md'), '/a/d.md');
});

test('strips fragment and query, decodes percent-encoding', () => {
  assert.equal(resolveRelativePath('/a/c.md', 'my%20note.md#h?q=1'), '/a/my note.md');
});

test('windows separators are kept', () => {
  assert.equal(resolveRelativePath('C:\\a\\b.md', 'c\\d.md'), 'C:\\a\\c\\d.md');
});

test('UNC prefix is restored', () => {
  assert.equal(resolveRelativePath('\\\\srv\\share\\b.md', 'c.md'), '\\\\srv\\share\\c.md');
});
