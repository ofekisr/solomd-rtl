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
