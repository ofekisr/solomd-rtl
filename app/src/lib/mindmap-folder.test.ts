import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sortFolderFiles, parseSkipKeywords, matchesSkipKeyword, hasEpubSkip,
  fileTitle, subfolderOf, buildFolderMap, countNodes,
} from './mindmap-folder.ts';

const f = (relPath: string, text: string) => ({ absPath: `/ws/book/${relPath}`, relPath, text });

test('files sort lexically by relative path', () => {
  assert.deepEqual(sortFolderFiles([f('10-b.md', ''), f('02-a.md', ''), f('a/01.md', '')]).map((x) => x.relPath), ['02-a.md', '10-b.md', 'a/01.md']);
});

test('skip keywords are whole-word, case-insensitive, Hebrew-aware', () => {
  const kw = parseSkipKeywords(' Draft, טיוטה ,draft,');
  assert.deepEqual(kw, ['Draft', 'טיוטה']);
  assert.equal(matchesSkipKeyword('My DRAFT notes', kw), true);
  assert.equal(matchesSkipKeyword('Drafting', kw), false);
  assert.equal(matchesSkipKeyword('פרק טיוטה', kw), true);
  assert.equal(matchesSkipKeyword('a (b) c', parseSkipKeywords('(b)')), true);
});

test('epub skip directive is honored outside fences only', () => {
  assert.equal(hasEpubSkip('<!-- epub: toc=false, skip=true -->\n# A'), true);
  assert.equal(hasEpubSkip('```\n<!-- epub: skip=true -->\n```'), false);
  assert.equal(hasEpubSkip('<!-- epub: skip=false -->'), false);
  assert.equal(hasEpubSkip('<!-- epub: skip = true -->'), true);
});

test('title is the sole H1, else the stem; subfolder is the dir part', () => {
  assert.equal(fileTitle(f('a/01-x.md', '# Intro\n## s')), 'Intro');
  assert.equal(fileTitle(f('02-y.md', '# A\n# B')), '02-y');
  assert.equal(fileTitle(f('03-z.md', 'intro\n# Only')), '03-z');
  assert.equal(fileTitle(f('04.md', '## Sole')), 'Sole');
  assert.equal(subfolderOf('a/b/c.md'), 'a/b');
  assert.equal(subfolderOf('c.md'), undefined);
});

test('folder map merges files with prefixed ids and workspace-relative sources', () => {
  const map = buildFolderMap('book', [f('01.md', '# One\n- x'), f('part/02.md', '# Two')], { groupBySubfolder: true, workspaceRoot: '/ws' });
  const [one, group] = map.nodeData.children ?? [];
  assert.equal(map.nodeData.topic, 'book');
  assert.deepEqual([one.id, one.topic], ['f01-root', 'One']);
  assert.deepEqual(one.children?.[0].metadata, { source: { line: 2, path: 'book/01.md' } });
  assert.deepEqual([group.topic, group.children?.[0].id], ['part', 'f02-root']);
  assert.equal(countNodes(map), 5);
});
