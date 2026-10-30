import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import {
  buildFolderTreeMap, matchingTags, parseTagRules, rowRange, visibleRows,
  type ScannedFolder, type TreeEntry, type TreeOptions,
} from './folder-tree.ts';
import { applyScope, defaultScopeRules } from './folder-scope.ts';

const dir = (relPath: string, files: string[], folders: ScannedFolder[] = []): ScannedFolder =>
  ({ name: relPath.split('/').pop() || 'repo', relPath, files, folders });

const tree = dir('', ['README.md', '.env'], [
  dir('.claude', ['settings.json']),
  dir('docs', ['CLAUDE.md']),
  dir('src', ['a.ts', 'a.spec.ts', 'b.spec.ts'], [dir('src/util', ['u.ts'])]),
]);

const options = (patch: Partial<TreeOptions> = {}): TreeOptions => ({
  scope: defaultScopeRules(), wrapFiles: true,
  tagRules: [{ suffix: '.spec.ts', tag: 'tests' }, { suffix: 'claude.md', tag: 'claude' }],
  filesTopic: (count) => `Files (${count})`, ...patch,
});

const topics = (node: NodeObj): string[] => (node.children ?? []).map((c) => c.topic);
const child = (node: NodeObj, topic: string): NodeObj => {
  const found = node.children?.find((c) => c.topic === topic);
  assert.ok(found, `missing child ${topic}`);
  return found;
};

test('default scope wraps files first and skips hidden entries', () => {
  const root = buildFolderTreeMap(tree, options()).nodeData;
  assert.equal(root.topic, 'repo');
  assert.deepEqual(topics(root), ['Files (1)', 'docs', 'src']);
  assert.deepEqual(topics(child(root, 'src')), ['Files (3)', 'util']);
});

test('without wrapping, files follow subfolders', () => {
  const root = buildFolderTreeMap(tree, options({ wrapFiles: false })).nodeData;
  assert.deepEqual(topics(child(root, 'src')), ['util', 'a.ts', 'a.spec.ts', 'b.spec.ts']);
});

test('tags go on the folder only, deduped and case-insensitive', () => {
  const root = buildFolderTreeMap(tree, options()).nodeData;
  assert.deepEqual(child(root, 'src').tags, ['tests']);
  assert.deepEqual(child(root, 'docs').tags, ['claude']);
  assert.equal(root.tags, undefined);
});

test('excluding a folder non-recursively keeps it as a path node for its subfolders', () => {
  const scope = applyScope(defaultScopeRules(), [{ path: 'src', isDir: true }], 'exclude', false);
  const src = child(buildFolderTreeMap(tree, options({ scope })).nodeData, 'src');
  assert.deepEqual(topics(src), ['util']);
  assert.equal(src.tags, undefined);
});

test('recursive exclusion removes the subtree', () => {
  const scope = applyScope(defaultScopeRules(), [{ path: 'src', isDir: true }], 'exclude', true);
  assert.deepEqual(topics(buildFolderTreeMap(tree, options({ scope })).nodeData), ['Files (1)', 'docs']);
});

test('explicitly included hidden entries appear', () => {
  const scope = applyScope(defaultScopeRules(), [{ path: '.claude', isDir: true }, { path: '.env', isDir: false }], 'include', true);
  const root = buildFolderTreeMap(tree, options({ scope })).nodeData;
  assert.deepEqual(topics(root), ['Files (2)', '.claude', 'docs', 'src']);
});

test('an empty scope still yields the root node', () => {
  const root = buildFolderTreeMap(tree, options({ scope: new Map() })).nodeData;
  assert.equal(root.topic, 'repo');
  assert.equal(root.children, undefined);
});

test('node ids are unique', () => {
  const ids: string[] = [];
  const walk = (n: NodeObj): void => { ids.push(n.id); n.children?.forEach(walk); };
  walk(buildFolderTreeMap(tree, options({ wrapFiles: false })).nodeData);
  assert.equal(new Set(ids).size, ids.length);
});

const entries = new Map<string, TreeEntry[]>([
  ['', [{ name: '.git', relPath: '.git', isDir: true }, { name: 'src', relPath: 'src', isDir: true }, { name: 'a.md', relPath: 'a.md', isDir: false }]],
  ['src', [{ name: 'x.ts', relPath: 'src/x.ts', isDir: false }]],
]);

test('visibleRows shows only expanded folders and hides dot entries unless shown', () => {
  const collapsed = visibleRows('repo', entries, new Set(['']), false);
  assert.deepEqual(collapsed.map((r) => [r.relPath, r.depth]), [['', 0], ['src', 1], ['a.md', 1]]);
  const open = visibleRows('repo', entries, new Set(['', 'src']), true);
  assert.deepEqual(open.map((r) => r.relPath), ['', '.git', 'src', 'src/x.ts', 'a.md']);
  assert.ok(open[1].isHidden);
});

test('rowRange selects between anchor and target in either direction', () => {
  const rows = visibleRows('repo', entries, new Set(['', 'src']), false);
  assert.deepEqual(rowRange(rows, 'a.md', 'src').map((r) => r.relPath), ['src', 'src/x.ts', 'a.md']);
  assert.deepEqual(rowRange(rows, 'gone', 'src').map((r) => r.relPath), ['src']);
});

test('matchingTags ignores rules with empty parts', () => {
  assert.deepEqual(matchingTags(['x.spec.ts'], [{ suffix: '', tag: 'all' }, { suffix: '.ts', tag: '' }]), []);
});

test('parseTagRules keeps valid trimmed rows from unknown input', () => {
  const parsed = parseTagRules([{ suffix: ' .spec.ts ', tag: ' tests ' }, { suffix: '', tag: 'x' }, 'junk', { suffix: 1 }]);
  assert.deepEqual(parsed, [{ suffix: '.spec.ts', tag: 'tests' }]);
  assert.deepEqual(parseTagRules('nope'), []);
});
