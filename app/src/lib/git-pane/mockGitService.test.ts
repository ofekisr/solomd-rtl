import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMockGitService } from './mockGitService.ts'

test('open returns the seeded snapshot', async () => {
  const svc = createMockGitService()
  const res = await svc.open('/repo/notes', false)
  assert.equal(res.ok, true)
  assert.equal(res.snapshot?.repository.currentBranch, 'main')
})

test('open reports no-repo for the configured folder', async () => {
  const svc = createMockGitService({ notARepo: true })
  const res = await svc.open('/tmp/plain', false)
  assert.equal(res.ok, false)
  assert.equal(res.error?.code, 'RepositoryNotFound')
})

test('stage moves a file to staged and records the call', async () => {
  const svc = createMockGitService()
  await svc.open('/repo', false)
  await svc.execute({ kind: 'stage', target: 'README.md' })
  const snap = await svc.snapshot()
  assert.ok(snap.workingTree.some((f) => f.path === 'README.md' && f.staged))
  assert.deepEqual(svc.calls.map((c) => c.kind), ['stage'])
})

test('commit clears staged files and prepends a commit', async () => {
  const svc = createMockGitService()
  await svc.open('/repo', false)
  await svc.execute({ kind: 'stage', target: 'README.md' })
  await svc.execute({ kind: 'commit', meta: { message: 'docs: readme' } })
  const snap = await svc.snapshot()
  assert.equal(snap.commits[0].subject, 'docs: readme')
  assert.equal(snap.workingTree.some((f) => f.staged), false)
})

test('onChanged listeners fire and unsubscribe', () => {
  const svc = createMockGitService()
  let hits = 0
  const off = svc.onChanged(() => { hits += 1 })
  svc.emitChanged()
  off()
  svc.emitChanged()
  assert.equal(hits, 1)
})
