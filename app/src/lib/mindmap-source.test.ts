import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData } from 'mind-elixir';
import { fenceNodeSource, isMarkdownSourcePath, isSafeSourcePath, plaintextNodeLines, preorderIds, readNodeSource, resolveSourcePath, toWorkspaceRelative } from './mindmap-source.ts';
import { parseMindmapFence } from './mindmap-fence.ts';

const BODY = ['- Root', '  - Alpha [^a1]', '    - Child', '  - Beta', '    - B1', '    - B2', '    - }Sum', '  - Gamma [^b9]', '- > [^a1] <-lbl-> [^b9]'].join('\n');

test('node lines skip summary and arrow lines', () => {
  assert.deepEqual(plaintextNodeLines(BODY), [0, 1, 2, 3, 4, 5, 7]);
});

test('fence node source maps preorder index to editor line', () => {
  const parsed = parseMindmapFence(BODY);
  assert.ok(parsed.ok);
  const data: MindElixirData = parsed.data;
  const ids = preorderIds(data.nodeData);
  const gammaId = ids[ids.length - 1];
  const fenceLine = 10;
  assert.deepEqual(fenceNodeSource(data, gammaId, fenceLine), { line: fenceLine + 2 + 7 });
  assert.deepEqual(fenceNodeSource(data, data.nodeData.id, fenceLine), { line: fenceLine + 2 });
});

test('unknown node has no source', () => {
  const parsed = parseMindmapFence('- R\n  - A');
  assert.ok(parsed.ok);
  assert.equal(fenceNodeSource(parsed.data, 'missing', 0), null);
});

test('metadata source is validated', () => {
  assert.deepEqual(readNodeSource({ id: 'a', topic: 'A', metadata: { source: { path: 'n.md', line: 4 } } }), { path: 'n.md', line: 4 });
  assert.deepEqual(readNodeSource({ id: 'a', topic: 'A', metadata: { source: { line: 2 } } }), { line: 2 });
  assert.equal(readNodeSource({ id: 'a', topic: 'A', metadata: { source: { line: 0 } } }), null);
  assert.equal(readNodeSource({ id: 'a', topic: 'A', metadata: { source: { line: 2, path: 5 } } }), null);
  assert.equal(readNodeSource({ id: 'a', topic: 'A' }), null);
});

test('isSafeSourcePath rejects absolute, drive, scheme, backslash and dot segments', () => {
  for (const bad of ['/etc/passwd', 'C:/x.md', 'file:///x', 'a\\b.md', '../x.md', 'a/../b.md', './a.md', '', 'a\0b'])
    assert.equal(isSafeSourcePath(bad), false, bad);
  assert.equal(isSafeSourcePath('notes/פרק 1.md'), true);
});

test('readNodeSource drops an unsafe path', () => {
  assert.equal(readNodeSource({ id: 'a', topic: 'a', metadata: { source: { line: 2, path: '/abs.md' } } }), null);
});

test('toWorkspaceRelative and resolveSourcePath round-trip', () => {
  assert.equal(toWorkspaceRelative('/ws/notes/a.md', '/ws/'), 'notes/a.md');
  assert.equal(toWorkspaceRelative('/other/a.md', '/ws'), undefined);
  assert.equal(toWorkspaceRelative('C:\\ws\\a.md', 'C:\\ws'), 'a.md');
  assert.equal(resolveSourcePath('/ws/', 'notes/a.md'), '/ws/notes/a.md');
});

test('markdown source paths are detected by extension', () => {
  assert.ok(isMarkdownSourcePath('a/b.md'));
  assert.ok(isMarkdownSourcePath('A.MARKDOWN'));
  assert.ok(!isMarkdownSourcePath('a/b.txt'));
  assert.ok(!isMarkdownSourcePath('a/b.mmap'));
});
