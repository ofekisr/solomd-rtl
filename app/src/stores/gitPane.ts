import { defineStore } from 'pinia'
import type { WireCommit, WireRepositorySnapshot, WireWorkingTreeFile } from '../lib/git-pane/shared/models.ts'
import { GitPaneError, type GitPaneAction, type GitPaneActionKind, type GitPaneService } from '../lib/git-pane/service.ts'
import { toGitPaneError } from '../lib/git-pane/validate.ts'
import { getGitPaneService } from '../lib/git-pane/serviceFactory.ts'

export type { DiffSide } from '../lib/git-pane/service.ts'
export type GitPaneStatus = 'idle' | 'loading' | 'ready' | 'no-repo' | 'no-git' | 'error'

const REFRESH_THROTTLE_MS = 250
const PAGE_SIZE = 200
const NO_REPO_CODES = new Set(['RepositoryNotFound', 'NotARepository'])

let service: GitPaneService | null = null
let unsubscribe: (() => void) | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null

function svc(): GitPaneService {
  service ??= getGitPaneService()
  return service
}

interface State {
  status: GitPaneStatus
  repoRoot: string | null
  snapshot: WireRepositorySnapshot | null
  commits: WireCommit[]
  hasMoreCommits: boolean
  selectedSha: string | null
  selectedFiles: WireWorkingTreeFile[]
  included: string[]
  message: string
  amend: boolean
  busyOp: GitPaneActionKind | null
  lastError: GitPaneError | null
}

export const useGitPaneStore = defineStore('gitPane', {
  state: (): State => ({
    status: 'idle', repoRoot: null, snapshot: null, commits: [], hasMoreCommits: false,
    selectedSha: null, selectedFiles: [], included: [], message: '', amend: false,
    busyOp: null, lastError: null,
  }),
  getters: {
    stagedFiles: (s): WireWorkingTreeFile[] => s.snapshot?.workingTree.filter((f) => f.staged) ?? [],
    unstagedFiles: (s): WireWorkingTreeFile[] =>
      s.snapshot?.workingTree.filter((f) => !f.staged && f.status !== 'untracked' && f.status !== 'conflicted') ?? [],
    untrackedFiles: (s): WireWorkingTreeFile[] => s.snapshot?.workingTree.filter((f) => f.status === 'untracked') ?? [],
    conflictedFiles: (s): WireWorkingTreeFile[] => s.snapshot?.workingTree.filter((f) => f.status === 'conflicted') ?? [],
    currentBranch: (s): string => s.snapshot?.repository.currentBranch ?? '',
    aheadBehind: (s): { ahead: number; behind: number } => ({
      ahead: s.snapshot?.repository.ahead ?? 0,
      behind: s.snapshot?.repository.behind ?? 0,
    }),
    canCommit(): boolean {
      const hasContent = this.stagedFiles.length > 0 || this.included.length > 0 || this.amend
      return hasContent && this.message.trim().length > 0 && this.busyOp === null
    },
  },
  actions: {
    bindService(next?: GitPaneService): () => void {
      unsubscribe?.()
      service = next ?? getGitPaneService()
      unsubscribe = service.onChanged(() => this.scheduleRefresh())
      return () => unsubscribe?.()
    },
    scheduleRefresh(): void {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => { void this.refresh() }, REFRESH_THROTTLE_MS)
    },
    applySnapshot(snap: WireRepositorySnapshot): void {
      this.snapshot = snap
      this.commits = snap.commits
      this.hasMoreCommits = snap.page.hasMore
      this.repoRoot = snap.repository.path
      const paths = new Set(snap.workingTree.map((f) => f.path))
      this.included = this.included.filter((p) => paths.has(p))
      this.status = 'ready'
    },
    async open(folder: string | null): Promise<void> {
      this.$reset()
      if (!folder) return
      this.status = 'loading'
      if (!(await svc().version())) {
        this.status = 'no-git'
        return
      }
      try {
        const res = await svc().open(folder)
        if (res.ok && res.snapshot) return this.applySnapshot(res.snapshot)
        this.status = res.error && NO_REPO_CODES.has(res.error.code) ? 'no-repo' : 'error'
        this.lastError = res.error ? new GitPaneError(res.error.code, res.error.message) : null
      } catch (e) {
        this.status = 'error'
        this.lastError = toGitPaneError(e)
      }
    },
    async refresh(): Promise<void> {
      if (this.status !== 'ready') return
      try {
        this.applySnapshot(await svc().snapshot())
      } catch (e) {
        this.lastError = toGitPaneError(e)
      }
    },
    async loadMoreCommits(): Promise<void> {
      const oldest = this.commits.at(-1)?.sha
      if (!oldest || !this.hasMoreCommits) return
      const res = await svc().commitPage({ beforeSha: oldest, limit: PAGE_SIZE, graphScope: 'all', skip: this.commits.length })
      const known = new Set(this.commits.map((c) => c.sha))
      this.commits = [...this.commits, ...res.commits.filter((c) => !known.has(c.sha))]
      this.hasMoreCommits = res.page.hasMore
    },
    async run(action: GitPaneAction): Promise<boolean> {
      if (this.busyOp) return false
      this.busyOp = action.kind
      this.lastError = null
      try {
        const env = await svc().execute(action)
        if (!env.ok) {
          this.lastError = new GitPaneError(env.error?.code ?? 'unknown', env.error?.message ?? env.message)
          return false
        }
        return true
      } catch (e) {
        this.lastError = toGitPaneError(e)
        return false
      } finally {
        this.busyOp = null
        await this.refresh()
      }
    },
    async stageIncluded(): Promise<boolean> {
      for (const path of this.included) {
        const isAlreadyStaged = this.stagedFiles.some((f) => f.path === path)
        if (!isAlreadyStaged && !(await this.run({ kind: 'stage', target: path }))) return false
      }
      return true
    },
    async commit(opts: { push: boolean; force?: boolean }): Promise<boolean> {
      if (!this.canCommit) return false
      if (!(await this.stageIncluded())) return false
      const kind: GitPaneActionKind = opts.push ? (opts.force ? 'commit-and-force-push' : 'commit-and-push') : (this.amend ? 'amend' : 'commit')
      const ok = await this.run({ kind, meta: { message: this.message.trim(), amend: this.amend } })
      if (ok) {
        this.message = ''
        this.amend = false
        this.included = []
      }
      return ok
    },
    async selectCommit(sha: string | null): Promise<void> {
      this.selectedSha = sha
      this.selectedFiles = sha ? await svc().commitFiles(sha) : []
    },
    toggleIncluded(path: string): void {
      this.included = this.included.includes(path) ? this.included.filter((p) => p !== path) : [...this.included, path]
    },
  },
})
