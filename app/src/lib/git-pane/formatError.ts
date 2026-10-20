import { DEFAULT_MESSAGES, type GitErrorCode } from './shared/errors.ts'
import { credentialHintFor } from './shared/credentialHints.ts'

const HINTED_CODES = new Set<string>(['Authentication', 'Network'])

export function formatGitErrorToast(err: { code: string; message: string }): string {
  const message = err.message.trim() || DEFAULT_MESSAGES[err.code as GitErrorCode] || ''
  const hint = HINTED_CODES.has(err.code) ? credentialHintFor(err.code as GitErrorCode) : undefined
  return hint ? `${message} ${hint}` : message
}

const ALWAYS_SILENT_CODES = new Set<string>(['Cancelled'])
const CHECKOUT_HANDLED_CODE = 'DirtyWorktree'
const CHECKOUT_KIND = 'checkout'

export function isSilentGitError(code: string, failedKind: string | null): boolean {
  if (ALWAYS_SILENT_CODES.has(code)) return true
  return code === CHECKOUT_HANDLED_CODE && failedKind === CHECKOUT_KIND
}
