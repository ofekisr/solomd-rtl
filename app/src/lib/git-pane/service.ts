import type {
  ActionEnvelope, CommitPageRequest, CommitPageResult, DiffRequest, DiffResult,
  WireRepositorySnapshot, WireWorkingTreeFile,
} from './shared/models.ts'
import type { SerializedGitError } from './shared/errors.ts'

export type GitPaneActionKind =
  | 'refresh' | 'stage' | 'unstage' | 'stage-all' | 'unstage-all'
  | 'stage-patch' | 'unstage-patch' | 'discard-file' | 'discard-patch'
  | 'commit' | 'amend' | 'commit-and-push' | 'commit-and-force-push'
  | 'checkout' | 'create-branch' | 'delete-branch' | 'stash'
  | 'fetch' | 'pull' | 'push' | 'force-push'

export interface GitPaneAction {
  kind: GitPaneActionKind
  target?: string
  meta?: Record<string, unknown>
}

export type DiffSide = 'worktree' | 'index' | 'commit'

export interface OpenResult {
  ok: boolean
  snapshot?: WireRepositorySnapshot
  error?: SerializedGitError
}

export interface GitVersionInfo {
  version: string
  gitPath: string | null
}

export interface GitPaneService {
  version(): Promise<GitVersionInfo | null>
  open(folder: string, isTrusted: boolean): Promise<OpenResult>
  close(): Promise<void>
  snapshot(): Promise<WireRepositorySnapshot>
  commitPage(request: CommitPageRequest): Promise<CommitPageResult>
  diff(request: DiffRequest): Promise<DiffResult>
  commitFiles(sha: string): Promise<WireWorkingTreeFile[]>
  execute(action: GitPaneAction): Promise<ActionEnvelope>
  cancel(): Promise<void>
  onChanged(listener: () => void): () => void
}

export class GitPaneError extends Error {
  code: string
  detail?: string

  constructor(code: string, message: string, detail?: string) {
    super(message)
    this.code = code
    this.detail = detail
  }
}
