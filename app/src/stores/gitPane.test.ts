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
  store.setTrustedRoots([])
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

test('late response for a previous folder does not overwrite the current one', async () => {
  const { store, svc } = storeWith()
  const realOpen = svc.open.bind(svc)
  svc.open = async (folder: string, isTrusted: boolean) => {
    if (folder === '/a') await new Promise((r) => setTimeout(r, 60))
    const res = await realOpen(folder, isTrusted)
    if (res.snapshot) res.snapshot.repository.path = folder
    return res
  }
  const first = store.open('/a')
  const second = store.open('/b')
  await Promise.all([first, second])
  assert.equal(store.repoRoot, '/b')
  assert.equal(store.status, 'ready')
})

test('open cancels a pending scheduled refresh', async () => {
  const { store, svc } = storeWith()
  await store.open('/repo')
  svc.emitChanged()
  await store.open(null)
  await new Promise((r) => setTimeout(r, 400))
  assert.equal(store.status, 'idle')
  assert.equal(store.snapshot, null)
})

test('concurrent run calls are queued in order and both succeed', async () => {
  const { store, svc } = storeWith()
  await store.open('/repo')
  const a = store.run({ kind: 'stage', target: 'README.md' })
  const b = store.run({ kind: 'unstage', target: 'notes/todo.md' })
  assert.deepEqual(await Promise.all([a, b]), [true, true])
  assert.deepEqual(svc.calls.map((c) => c.kind), ['stage', 'unstage'])
  assert.equal(store.busyOp, null)
})

test('busyOp stays set until the post-write refresh completes', async () => {
  const { store, svc } = storeWith()
  await store.open('/repo')
  let busyDuringRefresh: string | null = null
  const realSnapshot = svc.snapshot.bind(svc)
  svc.snapshot = async () => {
    busyDuringRefresh = store.busyOp
    return realSnapshot()
  }
  await store.run({ kind: 'stage', target: 'README.md' })
  assert.equal(busyDuringRefresh, 'stage')
  assert.equal(store.busyOp, null)
})

test('selectCommit keeps the latest selection when responses arrive out of order', async () => {
  const { store, svc } = storeWith()
  await store.open('/repo')
  const real = svc.commitFiles.bind(svc)
  svc.commitFiles = async (sha: string) => {
    if (sha === 'slow') await new Promise((r) => setTimeout(r, 60))
    const files = await real(sha)
    return sha === 'slow' ? [] : files
  }
  const sha = store.commits[0].sha
  const slow = store.selectCommit('slow')
  const fast = store.selectCommit(sha)
  await Promise.all([slow, fast])
  assert.equal(store.selectedSha, sha)
  assert.ok(store.selectedFiles.length > 0)
})

test('selectCommit and loadMoreCommits record errors instead of throwing', async () => {
  const { store, svc } = storeWith()
  await store.open('/repo')
  svc.commitFiles = async () => { throw new Error('boom') }
  svc.commitPage = async () => { throw new Error('boom') }
  await store.selectCommit(store.commits[0].sha)
  assert.ok(store.lastError)
  store.lastError = null
  store.hasMoreCommits = true
  await store.loadMoreCommits()
  assert.ok(store.lastError)
})

test('a queued run is dropped when the folder changes before it starts', async () => {
  const { store, svc } = storeWith()
  await store.open('/repo')
  const stale = store.run({ kind: 'push' })
  const reopen = store.open('/b')
  assert.equal(await stale, false)
  await reopen
  assert.deepEqual(svc.calls, [])
  assert.equal(store.busyOp, null)
  assert.equal(store.lastError, null)
})

test('commit runs stage + commit as one unit before later queued actions', async () => {
  const { store, svc } = storeWith()
  await store.open('/repo')
  store.toggleIncluded('README.md')
  store.message = 'docs: x'
  const commit = store.commit({ push: false })
  const other = store.run({ kind: 'fetch' })
  assert.deepEqual(await Promise.all([commit, other]), [true, true])
  assert.deepEqual(svc.calls.map((c) => c.kind), ['stage', 'commit', 'fetch'])
})

test('commit does not run against a new folder opened during staging', async () => {
  const { store, svc } = storeWith()
  await store.open('/repo')
  store.toggleIncluded('README.md')
  store.message = 'docs: x'
  const realExecute = svc.execute.bind(svc)
  svc.execute = async (action) => {
    const res = await realExecute(action)
    if (action.kind === 'stage') {
      await store.open('/b')
      store.message = 'typed in b'
    }
    return res
  }
  store.message = 'docs: x'
  assert.equal(await store.commit({ push: false }), false)
  assert.deepEqual(svc.calls.map((c) => c.kind), ['stage'])
  assert.equal(store.message, 'typed in b')
})

test('run is refused unless the pane is ready', async () => {
  const { store, svc } = storeWith({ notARepo: true })
  await store.open('/plain')
  assert.equal(await store.run({ kind: 'fetch' }), false)
  assert.deepEqual(svc.calls, [])
})

test('a failed open closes the backend', async () => {
  const { store, svc } = storeWith({ notARepo: true })
  await store.open('/plain')
  assert.equal(svc.closeCount, 1)
})

test('open(null) closes the backend', async () => {
  const { store, svc } = storeWith()
  await store.open('/repo')
  await store.open(null)
  assert.equal(svc.closeCount, 1)
})

test('failed action records which kind failed', async () => {
  const { store } = storeWith({ dirtyPull: true })
  await store.open('/repo')
  assert.equal(await store.run({ kind: 'pull' }), false)
  assert.equal(store.lastError?.code, 'DirtyWorktree')
  assert.equal(store.lastErrorKind, 'pull')
})

test('untrusted repo enters untrusted status without a snapshot', async () => {
  const { store } = storeWith({ untrusted: true })
  await store.open('/repo')
  assert.equal(store.status, 'untrusted')
  assert.equal(store.snapshot, null)
  assert.equal(store.untrustedRoot, '/repo')
  assert.deepEqual(store.untrustedKeys, ['core.hookspath', 'filter.lfs.clean'])
})

test('trustAndReopen opens the untrusted repo', async () => {
  const { store } = storeWith({ untrusted: true })
  await store.open('/repo')
  await store.trustAndReopen()
  assert.equal(store.status, 'ready')
})

test('a repo already in the trusted list opens directly', async () => {
  const { store } = storeWith({ untrusted: true })
  store.setTrustedRoots(['/repo'])
  await store.open('/repo')
  assert.equal(store.status, 'ready')
})

test('commit file count does not double-count included staged files', async () => {
  const { store } = storeWith()
  await store.open('/repo')
  store.toggleIncluded('notes/todo.md')
  store.toggleIncluded('README.md')
  assert.equal(store.commitFileCount, 2)
})

test('cancel goes through the service', async () => {
  const { store, svc } = storeWith()
  let cancelled = 0
  svc.cancel = async () => { cancelled += 1 }
  await store.cancel()
  assert.equal(cancelled, 1)
})
