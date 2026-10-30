import type { CommitPageRequest, DiffRequest } from '../../lib/git-pane/shared/models.ts'
import type { GitPaneAction, GitPaneService, GitVersionInfo, OpenResult } from '../../lib/git-pane/service.ts'
import {
  ensure,
  isCommitPage,
  isDiffResult,
  isEnvelope,
  isFileList,
  isSnapshot,
  toGitPaneError,
} from '../../lib/git-pane/validate.ts'
import type { EventsPort } from '../events/events.port.ts'
import type { InvokeFn } from '../ipc/command.port.ts'

const CHANGED_EVENT = 'gitpane:changed'
const SNAPSHOT_COMMIT_LIMIT = 200

export function createTauriGitPaneService(invoke: InvokeFn, listen: EventsPort['listen']): GitPaneService {
  async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    try {
      return (await invoke(cmd, args)) as T
    } catch (e) {
      throw toGitPaneError(e)
    }
  }

  return {
    async version(): Promise<GitVersionInfo | null> {
      try {
        return await call<GitVersionInfo>('gitpane_version')
      } catch {
        return null
      }
    },
    async open(folder: string, isTrusted: boolean): Promise<OpenResult> {
      const options = { commitLimit: SNAPSHOT_COMMIT_LIMIT }
      const res = await call<OpenResult>('gitpane_open', { path: folder, options, trusted: isTrusted })
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
    async close() {
      await call('gitpane_close')
    },
    onChanged(listener: () => void) {
      let unlisten: (() => void) | null = null
      let isDisposed = false
      void listen<unknown>(CHANGED_EVENT, () => listener()).then((off) => {
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
