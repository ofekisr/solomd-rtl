import type {
  ActionEnvelope, CommitPageResult, DiffResult, WireRepositorySnapshot, WireWorkingTreeFile,
} from './shared/models.ts'
import type { SerializedGitError } from './shared/errors.ts'
import { GitPaneError } from './service.ts'

type Guard<T> = (value: unknown) => value is T

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isArray = Array.isArray
const isString = (v: unknown): v is string => typeof v === 'string'

export const isFileList: Guard<WireWorkingTreeFile[]> = (v): v is WireWorkingTreeFile[] =>
  isArray(v) && v.every((f) => isObject(f) && isString(f.path) && isString(f.status) && typeof f.staged === 'boolean')

export const isSnapshot: Guard<WireRepositorySnapshot> = (v): v is WireRepositorySnapshot =>
  isObject(v) &&
  isObject(v.repository) && isString(v.repository.currentBranch) &&
  isArray(v.commits) && isArray(v.branches) && isArray(v.tags) &&
  isObject(v.page) && isFileList(v.workingTree)

export const isCommitPage: Guard<CommitPageResult> = (v): v is CommitPageResult =>
  isObject(v) && isArray(v.commits) && isObject(v.page)

export const isDiffResult: Guard<DiffResult> = (v): v is DiffResult =>
  isObject(v) && isString(v.path) && typeof v.binary === 'boolean' && isArray(v.hunks)

export const isEnvelope: Guard<ActionEnvelope> = (v): v is ActionEnvelope =>
  isObject(v) && typeof v.ok === 'boolean' && isString(v.message)

export const isGitErrorPayload: Guard<SerializedGitError> = (v): v is SerializedGitError =>
  isObject(v) && v.__gitError === true && isString(v.code) && isString(v.message)

export function ensure<T>(value: unknown, guard: Guard<T>, what: string): T {
  if (guard(value)) return value
  throw new GitPaneError('protocol', `Unexpected ${what} from the git backend.`)
}

export function toGitPaneError(e: unknown): GitPaneError {
  if (e instanceof GitPaneError) return e
  if (isGitErrorPayload(e)) return new GitPaneError(e.code, e.message, e.detail ?? undefined)
  if (e instanceof Error) return new GitPaneError('unknown', e.message)
  return new GitPaneError('unknown', String(e))
}
