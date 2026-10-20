import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useGitPaneStore } from './gitPane.ts'
import { createMockGitService } from '../lib/git-pane/mockGitService.ts'

beforeEach(() => setActivePinia(createPinia()))

function storeWith(seed = {}) {
  const svc = createMockGitService(seed)
  const store = useGitPaneStore()
  store.bindService(svc)
  return { store, svc }
}

test('open → ready with grouped changes', async () => {
  const { store } = storeWith()
  await store.open('/repo')
  assert.equal(store.status, 'ready')
  assert.deepEqual(store.stagedFiles.map((f) => f.path), ['notes/todo.md'])
  assert.deepEqual(store.unstagedFiles.map((f) => f.path), ['README.md'])
  assert.deepEqual(store.untrackedFiles.map((f) => f.path), ['draft.md'])
})

test('open(null) → idle', async () => {
  const { store } = storeWith()
  await store.open(null)
  assert.equal(store.status, 'idle')
})

test('not a repo → no-repo', async () => {
  const { store } = storeWith({ notARepo: true })
  await store.open('/plain')
  assert.equal(store.status, 'no-repo')
})

test('git missing → no-git', async () => {
  const { store } = storeWith({ noGit: true })
  await store.open('/repo')
  assert.equal(store.status, 'no-git')
})

test('commit stages included unstaged files first, then commits', async () => {
  const { store, svc } = storeWith()
  await store.open('/repo')
  store.toggleIncluded('README.md')
  store.message = 'docs: update'
  const ok = await store.commit({ push: false })
  assert.equal(ok, true)
  assert.deepEqual(svc.calls.map((c) => c.kind), ['stage', 'commit'])
  assert.equal(store.message, '')
  assert.equal(store.commits[0].subject, 'docs: update')
})

test('commit without message is refused', async () => {
  const { store, svc } = storeWith()
  await store.open('/repo')
  assert.equal(await store.commit({ push: false }), false)
  assert.equal(svc.calls.length, 0)
})

test('commit and push uses commit-and-push', async () => {
  const { store, svc } = storeWith()
  await store.open('/repo')
  store.message = 'feat: x'
  await store.commit({ push: true })
  assert.equal(svc.calls.at(-1)?.kind, 'commit-and-push')
})

test('failed action sets lastError and returns false', async () => {
  const { store, svc } = storeWith()
  await store.open('/repo')
  svc.execute = async () => ({ ok: false, message: 'denied', error: { code: 'Authentication', message: 'denied' } as never })
  assert.equal(await store.run({ kind: 'push' }), false)
  assert.equal(store.lastError?.code, 'Authentication')
})

test('changed event triggers refresh', async () => {
  const { store, svc } = storeWith()
  await store.open('/repo')
  await svc.execute({ kind: 'stage', target: 'README.md' })
  svc.emitChanged()
  await new Promise((r) => setTimeout(r, 400))
  assert.ok(store.stagedFiles.some((f) => f.path === 'README.md'))
})
