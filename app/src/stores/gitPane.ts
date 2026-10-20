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
let generation = 0
let runQueue: Promise<unknown> = Promise.resolve()

function enqueue(job: (gen: number) => Promise<boolean>): Promise<boolean> {
  const gen = generation
  const result = runQueue.then(() => (gen === generation ? job(gen) : false))
  runQueue = result.catch(() => undefined)
  return result
}

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
      const gen = ++generation
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = null
      this.$reset()
      if (!folder) return
      this.status = 'loading'
      try {
        const version = await svc().version()
        if (gen !== generation) return
        if (!version) {
          this.status = 'no-git'
          return
        }
        const res = await svc().open(folder)
        if (gen !== generation) return
        if (res.ok && res.snapshot) return this.applySnapshot(res.snapshot)
        this.status = res.error && NO_REPO_CODES.has(res.error.code) ? 'no-repo' : 'error'
        this.lastError = res.error ? new GitPaneError(res.error.code, res.error.message) : null
      } catch (e) {
        if (gen !== generation) return
        this.status = 'error'
        this.lastError = toGitPaneError(e)
      }
    },
    async refresh(): Promise<void> {
      if (this.status !== 'ready') return
      const gen = generation
      try {
        const snap = await svc().snapshot()
        if (gen === generation) this.applySnapshot(snap)
      } catch (e) {
        if (gen === generation) this.lastError = toGitPaneError(e)
      }
    },
    async loadMoreCommits(): Promise<void> {
      const oldest = this.commits[this.commits.length - 1]?.sha
      if (!oldest || !this.hasMoreCommits) return
      const gen = generation
      try {
        const res = await svc().commitPage({ beforeSha: oldest, limit: PAGE_SIZE, graphScope: 'all', skip: this.commits.length })
        if (gen !== generation) return
        const known = new Set(this.commits.map((c) => c.sha))
        this.commits = [...this.commits, ...res.commits.filter((c) => !known.has(c.sha))]
        this.hasMoreCommits = res.page.hasMore
      } catch (e) {
        if (gen === generation) this.lastError = toGitPaneError(e)
      }
    },
    run(action: GitPaneAction): Promise<boolean> {
      return enqueue((gen) => this.execute(action, gen))
    },
    async execute(action: GitPaneAction, gen: number): Promise<boolean> {
      if (gen !== generation) return false
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
        await this.refresh()
        if (gen === generation) this.busyOp = null
      }
    },
    async stageIncluded(gen: number): Promise<boolean> {
      for (const path of [...this.included]) {
        const isAlreadyStaged = this.stagedFiles.some((f) => f.path === path)
        if (!isAlreadyStaged && !(await this.execute({ kind: 'stage', target: path }, gen))) return false
      }
      return true
    },
    commit(opts: { push: boolean; force?: boolean }): Promise<boolean> {
      if (!this.canCommit) return Promise.resolve(false)
      const kind: GitPaneActionKind = opts.push ? (opts.force ? 'commit-and-force-push' : 'commit-and-push') : (this.amend ? 'amend' : 'commit')
      const meta = { message: this.message.trim(), amend: this.amend }
      return enqueue(async (gen) => {
        if (!(await this.stageIncluded(gen))) return false
        const ok = await this.execute({ kind, meta }, gen)
        if (ok && gen === generation) {
          this.message = ''
          this.amend = false
          this.included = []
        }
        return ok
      })
    },
    async selectCommit(sha: string | null): Promise<void> {
      this.selectedSha = sha
      if (!sha) {
        this.selectedFiles = []
        return
      }
      const gen = generation
      try {
        const files = await svc().commitFiles(sha)
        if (gen === generation && this.selectedSha === sha) this.selectedFiles = files
      } catch (e) {
        if (gen === generation && this.selectedSha === sha) this.lastError = toGitPaneError(e)
      }
    },
    toggleIncluded(path: string): void {
      this.included = this.included.includes(path) ? this.included.filter((p) => p !== path) : [...this.included, path]
    },
  },
})
