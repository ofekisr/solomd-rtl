import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import {
  buildFolderTreeMap, defaultIncluded, folderRows, matchingTags, parseTagRules, setIncluded,
  type ScannedFolder, type TreeOptions,
} from './mindmap-folder-tree.ts';

const file = (name: string) => ({ name, isHidden: name.startsWith('.') });
const dir = (relPath: string, files: string[], folders: ScannedFolder[] = []): ScannedFolder => {
  const name = relPath.split('/').pop() || 'repo';
  return { name, relPath, isHidden: name.startsWith('.'), files: files.map(file), folders };
};

const tree = dir('', ['README.md', '.env'], [
  dir('src', ['a.ts', 'a.spec.ts', 'b.spec.ts'], [dir('src/util', ['u.ts'])]),
  dir('docs', ['CLAUDE.md']),
  dir('.claude', ['settings.json']),
]);

const options = (patch: Partial<TreeOptions> = {}): TreeOptions => ({
  included: defaultIncluded(tree), wrapFiles: true, showHidden: false,
  rules: [{ suffix: '.spec.ts', tag: 'tests' }, { suffix: 'claude.md', tag: 'claude' }],
  filesTopic: (count) => `Files (${count})`, ...patch,
});

const topics = (node: NodeObj): string[] => (node.children ?? []).map((c) => c.topic);
const child = (node: NodeObj, topic: string): NodeObj => {
  const found = node.children?.find((c) => c.topic === topic);
  assert.ok(found, `missing child ${topic}`);
  return found;
};

test('defaultIncluded selects every non-hidden folder', () => {
  assert.deepEqual([...defaultIncluded(tree)].sort(), ['', 'docs', 'src', 'src/util']);
});

test('wraps direct files into a files node placed first', () => {
  const root = buildFolderTreeMap(tree, options()).nodeData;
  assert.equal(root.topic, 'repo');
  assert.deepEqual(topics(root), ['Files (1)', 'src', 'docs']);
  assert.deepEqual(topics(child(root, 'Files (1)')), ['README.md']);
  assert.deepEqual(topics(child(root, 'src')), ['Files (3)', 'util']);
});

test('without wrapping, files are direct children after folders', () => {
  const root = buildFolderTreeMap(tree, options({ wrapFiles: false })).nodeData;
  assert.deepEqual(topics(child(root, 'src')), ['util', 'a.ts', 'a.spec.ts', 'b.spec.ts']);
});

test('a folder without files gets no files node', () => {
  const empty = dir('', [], [dir('x', [])]);
  const root = buildFolderTreeMap(empty, options({ included: defaultIncluded(empty) })).nodeData;
  assert.deepEqual(topics(root), ['x']);
  assert.equal(child(root, 'x').children, undefined);
});

test('folder tags are deduped, case-insensitive, and only on the folder', () => {
  const root = buildFolderTreeMap(tree, options()).nodeData;
  assert.deepEqual(child(root, 'src').tags, ['tests']);
  assert.deepEqual(child(root, 'docs').tags, ['claude']);
  assert.equal(child(child(root, 'src'), 'Files (3)').children?.[1].tags, undefined);
  assert.equal(root.tags, undefined);
});

test('an excluded folder drops its files and re-parents included subfolders', () => {
  const included = setIncluded(tree, options().included, 'src', false, false);
  const root = buildFolderTreeMap(tree, options({ included })).nodeData;
  assert.deepEqual(topics(root), ['Files (1)', 'util', 'docs']);
});

test('recursive exclusion removes the whole subtree', () => {
  const included = setIncluded(tree, options().included, 'src', false, true);
  assert.deepEqual([...included].sort(), ['', 'docs']);
});

test('recursive inclusion does not pull hidden folders in unless shown', () => {
  const none = new Set<string>();
  assert.deepEqual([...setIncluded(tree, none, '', true, true, false)].sort(), ['', 'docs', 'src', 'src/util']);
  assert.ok(setIncluded(tree, none, '', true, true, true).has('.claude'));
});

test('hidden files and folders appear only when shown', () => {
  const included = new Set([...defaultIncluded(tree), '.claude']);
  const hiddenOff = buildFolderTreeMap(tree, options({ included })).nodeData;
  assert.deepEqual(topics(hiddenOff), ['Files (1)', 'src', 'docs']);
  const hiddenOn = buildFolderTreeMap(tree, options({ included, showHidden: true })).nodeData;
  assert.deepEqual(topics(hiddenOn), ['Files (2)', 'src', 'docs', '.claude']);
});

test('node ids are unique', () => {
  const ids: string[] = [];
  const walk = (n: NodeObj): void => { ids.push(n.id); n.children?.forEach(walk); };
  walk(buildFolderTreeMap(tree, options({ wrapFiles: false })).nodeData);
  assert.equal(new Set(ids).size, ids.length);
});

test('matchingTags ignores rules with empty parts', () => {
  assert.deepEqual(matchingTags(['x.spec.ts'], [{ suffix: '', tag: 'all' }, { suffix: '.ts', tag: '' }]), []);
});

test('parseTagRules keeps valid trimmed rows from unknown input', () => {
  const parsed = parseTagRules([{ suffix: ' .spec.ts ', tag: ' tests ' }, { suffix: '', tag: 'x' }, 'junk', { suffix: 1 }]);
  assert.deepEqual(parsed, [{ suffix: '.spec.ts', tag: 'tests' }]);
  assert.deepEqual(parseTagRules('nope'), []);
});

test('folderRows lists folders depth-first with depth, hiding hidden ones unless shown', () => {
  assert.deepEqual(folderRows(tree, false).map((r) => [r.relPath, r.depth]), [['', 0], ['src', 1], ['src/util', 2], ['docs', 1]]);
  assert.ok(folderRows(tree, true).some((r) => r.relPath === '.claude'));
});
