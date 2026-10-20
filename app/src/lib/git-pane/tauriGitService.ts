import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { CommitPageRequest, DiffRequest } from './shared/models.ts'
import type { GitPaneAction, GitPaneService, GitVersionInfo, OpenResult } from './service.ts'
import { ensure, isCommitPage, isDiffResult, isEnvelope, isFileList, isSnapshot, toGitPaneError } from './validate.ts'

const CHANGED_EVENT = 'gitpane:changed'
const SNAPSHOT_COMMIT_LIMIT = 200

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args)
  } catch (e) {
    throw toGitPaneError(e)
  }
}

export function createTauriGitService(): GitPaneService {
  return {
    async version(): Promise<GitVersionInfo | null> {
      try {
        return await call<GitVersionInfo>('gitpane_version')
      } catch {
        return null
      }
    },
    async open(folder: string): Promise<OpenResult> {
      const res = await call<OpenResult>('gitpane_open', { path: folder, options: { commitLimit: SNAPSHOT_COMMIT_LIMIT } })
      if (res.ok) ensure(res.snapshot, isSnapshot, 'snapshot')
      return res
    },
    async snapshot() {
      return ensure(await call('gitpane_snapshot', { options: { commitLimit: SNAPSHOT_COMMIT_LIMIT } }), isSnapshot, 'snapshot')
    },
    async commitPage(request: CommitPageRequest) {
      return ensure(await call('gitpane_commit_page', { request }), isCommitPage, 'commit page')
    },
    async diff(request: DiffRequest) {
      return ensure(await call('gitpane_diff', { request }), isDiffResult, 'diff')
    },
    async commitFiles(sha: string) {
      return ensure(await call('gitpane_commit_files', { request: { sha } }), isFileList, 'commit files')
    },
    async execute(action: GitPaneAction) {
      return ensure(await call('gitpane_execute', { action }), isEnvelope, 'action result')
    },
    async cancel() {
      await call('gitpane_cancel')
    },
    onChanged(listener: () => void) {
      let unlisten: (() => void) | null = null
      let isDisposed = false
      void listen(CHANGED_EVENT, () => listener()).then((off) => {
        if (isDisposed) off()
        else unlisten = off
      })
      return () => {
        isDisposed = true
        unlisten?.()
      }
    },
  }
}
