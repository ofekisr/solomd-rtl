import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupChanges } from './groupChanges.ts'
import { buildBranchTree } from './branchTree.ts'
import { redactUrl } from './redactUrl.ts'
import { decodeDiffPath, encodeDiffPath, isDiffPath } from './diffTab.ts'
import { statusLetter } from './statusLetter.ts'
import { sampleSnapshot } from './mockGitService.ts'

test('groups changes in JetBrains order and omits empty groups', () => {
  const groups = groupChanges(sampleSnapshot().workingTree)
  assert.deepEqual(groups.map((g) => g.id), ['staged', 'changes', 'unversioned'])
})

test('status letters', () => {
  assert.equal(statusLetter('modified'), 'M')
  assert.equal(statusLetter('untracked'), '?')
  assert.equal(statusLetter('conflicted'), 'U')
})

test('branch tree nests slash groups and splits sections', () => {
  const snap = sampleSnapshot()
  const tree = buildBranchTree(snap.branches, snap.tags)
  assert.deepEqual(tree.map((n) => n.id), ['local', 'remote', 'tags'])
  const local = tree[0]
  const feature = local.children.find((n) => n.kind === 'folder' && n.label === 'feature')
  assert.ok(feature)
  assert.equal(feature.children[0].label, 'rtl')
})

test('redacts credentials in remote urls', () => {
  assert.equal(redactUrl('https://user:ghp_secret@github.com/a/b.git'), 'https://github.com/a/b.git')
  assert.equal(redactUrl('https://token@github.com/a/b.git'), 'https://github.com/a/b.git')
  assert.equal(redactUrl('git@github.com:a/b.git'), 'git@github.com:a/b.git')
})

test('diff path round-trips unicode and spaces', () => {
  const uri = encodeDiffPath({ path: 'notes/שלום עולם.md', side: 'commit', sha: 'abc1234' })
  assert.ok(isDiffPath(uri))
  assert.deepEqual(decodeDiffPath(uri), { path: 'notes/שלום עולם.md', side: 'commit', sha: 'abc1234' })
  assert.equal(decodeDiffPath('/Users/x/a.md'), null)
})

test('redacts passwords containing @ and leaves query strings alone', () => {
  assert.equal(redactUrl('https://user:p@ss@host/x'), 'https://host/x')
  assert.equal(redactUrl('https://host/x?a=b@c'), 'https://host/x?a=b@c')
})

test('decodeDiffPath returns null on malformed percent sequences', () => {
  assert.equal(decodeDiffPath('git-diff://%E0?side=worktree'), null)
})

test('diff path round-trips question marks and percent signs', () => {
  const ref = { path: 'a?b/100%.md', side: 'worktree' as const }
  assert.deepEqual(decodeDiffPath(encodeDiffPath(ref)), ref)
})

test('conflicted file lands in the conflicts group first', () => {
  const file = { id: 'c', path: 'c.md', fileName: 'c.md', directory: '', status: 'conflicted' as const, staged: false, additions: 0, deletions: 0 }
  const groups = groupChanges([...sampleSnapshot().workingTree, file])
  assert.equal(groups[0].id, 'conflicts')
  assert.deepEqual(groups[0].files, [file])
})

test('remote branch origin/feature/x nests origin, feature, x', () => {
  const snap = sampleSnapshot()
  const remote = { ...snap.branches[2], id: 'r:origin/feature/x', name: 'origin/feature/x' }
  const origin = buildBranchTree([remote], [])[1].children[0]
  assert.equal(origin.label, 'origin')
  assert.equal(origin.children[0].label, 'feature')
  assert.equal(origin.children[0].children[0].label, 'x')
})
