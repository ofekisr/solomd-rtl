import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyScope, defaultScopeRules, folderState, hasIncludeBelow, isPathIncluded, joinPath, parentOf,
} from './folder-scope.ts';

const dir = (path: string) => ({ path, isDir: true });
const file = (path: string) => ({ path, isDir: false });

test('path helpers', () => {
  assert.equal(parentOf('a/b/c'), 'a/b');
  assert.equal(parentOf('a'), '');
  assert.equal(joinPath('', 'a'), 'a');
  assert.equal(joinPath('a', 'b'), 'a/b');
});

test('default scope includes everything except hidden and node_modules', () => {
  const rules = defaultScopeRules();
  assert.ok(isPathIncluded('src/a/b.ts', false, rules));
  assert.ok(!isPathIncluded('.claude', true, rules));
  assert.ok(!isPathIncluded('src/.env', false, rules));
  assert.ok(!isPathIncluded('node_modules/x/y.js', false, rules));
});

test('explicitly including a hidden folder recursively includes its contents', () => {
  const rules = applyScope(defaultScopeRules(), [dir('.claude')], 'include', true);
  assert.ok(isPathIncluded('.claude', true, rules));
  assert.ok(isPathIncluded('.claude/settings.json', false, rules));
  assert.ok(!isPathIncluded('.claude/.secret', false, rules));
});

test('non-recursive include covers the folder and its direct files only', () => {
  const rules = applyScope(new Map(), [dir('src')], 'include', false);
  assert.ok(isPathIncluded('src', true, rules));
  assert.ok(isPathIncluded('src/a.ts', false, rules));
  assert.ok(!isPathIncluded('src/util', true, rules));
  assert.ok(!isPathIncluded('src/util/u.ts', false, rules));
});

test('closest rule wins', () => {
  let rules = applyScope(defaultScopeRules(), [dir('src')], 'exclude', true);
  rules = applyScope(rules, [file('src/keep.ts')], 'include', false);
  assert.ok(!isPathIncluded('src/a.ts', false, rules));
  assert.ok(isPathIncluded('src/keep.ts', false, rules));
  assert.ok(isPathIncluded('docs/x.md', false, rules));
});

test('recursive apply clears rules beneath it', () => {
  let rules = applyScope(defaultScopeRules(), [dir('src/util')], 'exclude', true);
  rules = applyScope(rules, [dir('src')], 'include', true);
  assert.ok(isPathIncluded('src/util/u.ts', false, rules));
  assert.equal(rules.has('src/util'), false);
});

test('recursive buttons act non-recursively on files', () => {
  const rules = applyScope(defaultScopeRules(), [file('a.ts')], 'exclude', true);
  assert.deepEqual(rules.get('a.ts'), { kind: 'exclude', isRecursive: false });
});

test('folderState reports included, excluded and partial', () => {
  const rules = defaultScopeRules();
  assert.equal(folderState('src', rules), 'included');
  assert.equal(folderState('.git', rules), 'excluded');
  assert.equal(folderState('src', applyScope(rules, [file('src/a.ts')], 'exclude', false)), 'partial');
  assert.equal(folderState('src', applyScope(rules, [dir('src')], 'exclude', false)), 'partial');
  assert.equal(folderState('src', applyScope(rules, [dir('src')], 'exclude', true)), 'excluded');
  assert.equal(folderState('', applyScope(rules, [dir('src')], 'exclude', true)), 'partial');
});

test('hasIncludeBelow finds nested include rules', () => {
  const rules = applyScope(applyScope(new Map(), [dir('a')], 'exclude', true), [file('a/b/c.ts')], 'include', false);
  assert.ok(hasIncludeBelow('a', rules));
  assert.ok(hasIncludeBelow('a/b', rules));
  assert.ok(!hasIncludeBelow('x', rules));
});
