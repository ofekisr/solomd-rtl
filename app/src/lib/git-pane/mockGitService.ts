import type {
  ActionEnvelope, WireAuthor, WireBranch, WireCommit, WireRepositorySnapshot, WireWorkingTreeFile,
} from './shared/models.ts'
import type { GitPaneAction, GitPaneService, OpenResult } from './service.ts'

export interface MockSeed {
  notARepo?: boolean
  noGit?: boolean
}

const MOCK_COMMIT_COUNT = 30
const MOCK_EPOCH = Date.UTC(2026, 9, 1)
const HOUR_MS = 3_600_000

const author: WireAuthor = { name: 'Dev', email: 'dev@example.com', avatarUrl: '', initials: 'D', color: '#888' }

function file(path: string, status: WireWorkingTreeFile['status'], staged: boolean): WireWorkingTreeFile {
  const slash = path.lastIndexOf('/')
  return {
    id: `${staged ? 'S' : 'W'}:${path}`, path, status, staged, additions: 1, deletions: 0,
    fileName: slash === -1 ? path : path.slice(slash + 1),
    directory: slash === -1 ? '' : path.slice(0, slash),
  }
}

function commit(i: number, parents: string[]): WireCommit {
  const sha = i.toString(16).padStart(40, 'a')
  return {
    sha, shortSha: sha.slice(0, 7), parents, subject: `commit ${i}`, author, committer: author,
    date: new Date(MOCK_EPOCH - i * HOUR_MS).toISOString(), refs: [], isMerge: parents.length > 1,
  }
}

function branch(name: string, kind: WireBranch['kind'], tipSha: string, isCurrent: boolean): WireBranch {
  return {
    id: `${kind}:${name}`, name, kind, group: '', tipSha, ahead: 0, behind: 0, isCurrent,
    isFavorite: false, lastActivity: new Date(MOCK_EPOCH).toISOString(), laneColorIndex: 0,
    remote: kind === 'remote' ? 'origin' : undefined,
  }
}

export function sampleSnapshot(): WireRepositorySnapshot {
  const commits = Array.from({ length: MOCK_COMMIT_COUNT }, (_, i) =>
    commit(i, i === MOCK_COMMIT_COUNT - 1 ? [] : [(i + 1).toString(16).padStart(40, 'a')]))
  commits[0].refs = [{ type: 'head', name: 'HEAD', label: 'HEAD', isHead: true }, { type: 'localBranch', name: 'main', label: 'main' }]
  return {
    repository: {
      name: 'repo', path: '/repo', gitVersion: 'git version 2.50.0', currentBranch: 'main', detached: false,
      headSha: commits[0].sha, ahead: 1, behind: 0, remoteUrl: 'https://github.com/example/repo.git',
      remotes: [{ name: 'origin', fetchUrl: 'https://github.com/example/repo.git', pushUrl: 'https://github.com/example/repo.git' }],
      state: { detachedHead: false, merging: false, rebasing: false, cherryPicking: false, reverting: false, bisecting: false, operationLabel: null },
      canUndo: false, canRedo: false, undoLabel: null, redoLabel: null,
    },
    commits,
    page: { oldestSha: commits[commits.length - 1].sha, hasMore: false, total: MOCK_COMMIT_COUNT },
    branches: [branch('main', 'local', commits[0].sha, true), branch('feature/rtl', 'local', commits[3].sha, false), branch('origin/main', 'remote', commits[1].sha, false)],
    tags: [{ id: 'tag:v1.0.0', name: 'v1.0.0', sha: commits[5].sha, message: '', date: new Date(MOCK_EPOCH).toISOString(), annotated: false }],
    stashes: [], worktrees: [],
    workingTree: [file('README.md', 'modified', false), file('notes/todo.md', 'added', true), file('draft.md', 'untracked', false)],
    authors: [author], commitAuthor: author,
  }
}

function applyAction(snap: WireRepositorySnapshot, action: GitPaneAction): void {
  const target = action.target
  if (action.kind === 'stage' && target) {
    snap.workingTree = snap.workingTree.map((f) => (f.path === target ? { ...f, staged: true, id: `S:${f.path}` } : f))
  }
  if (action.kind === 'unstage' && target) {
    snap.workingTree = snap.workingTree.map((f) => (f.path === target ? { ...f, staged: false, id: `W:${f.path}` } : f))
  }
  if (action.kind === 'commit' || action.kind === 'commit-and-push') {
    const next = commit(snap.commits.length, [snap.commits[0].sha])
    next.subject = String(action.meta?.message ?? '').split('\n')[0]
    snap.commits = [next, ...snap.commits]
    snap.workingTree = snap.workingTree.filter((f) => !f.staged)
  }
  if (action.kind === 'checkout' && target) {
    snap.repository.currentBranch = target
    snap.branches = snap.branches.map((b) => ({ ...b, isCurrent: b.kind === 'local' && b.name === target }))
  }
}

export function createMockGitService(seed: MockSeed = {}): GitPaneService & { calls: GitPaneAction[]; emitChanged(): void } {
  let snap = sampleSnapshot()
  const listeners = new Set<() => void>()
  const calls: GitPaneAction[] = []
  return {
    calls,
    emitChanged: () => listeners.forEach((l) => l()),
    async version() {
      return seed.noGit ? null : { version: 'git version 2.50.0', gitPath: '/opt/homebrew/bin/git' }
    },
    async open(): Promise<OpenResult> {
      if (seed.notARepo) return { ok: false, error: { __gitError: true, code: 'RepositoryNotFound', message: 'Not a git repository.' } }
      snap = sampleSnapshot()
      return { ok: true, snapshot: structuredClone(snap) }
    },
    async snapshot() {
      return structuredClone(snap)
    },
    async commitPage() {
      return { commits: [], page: { oldestSha: null, hasMore: false, total: snap.commits.length } }
    },
    async diff(request) {
      return {
        path: request.path, binary: false, tooLarge: false, language: 'markdown', additions: 1, deletions: 1,
        hunks: [{
          header: '@@ -1,2 +1,2 @@', oldStart: 1, oldLines: 2, newStart: 1, newLines: 2,
          lines: [
            { type: 'context', content: '# Title', oldLine: 1, newLine: 1 },
            { type: 'del', content: 'old line', oldLine: 2, newLine: null },
            { type: 'add', content: 'new line', oldLine: null, newLine: 2 },
          ],
        }],
      }
    },
    async commitFiles() {
      return [file('README.md', 'modified', false)]
    },
    async execute(action): Promise<ActionEnvelope> {
      calls.push(action)
      applyAction(snap, action)
      return { ok: true, message: `${action.kind} done` }
    },
    async cancel() {},
    onChanged(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
