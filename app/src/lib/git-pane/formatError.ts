import { DEFAULT_MESSAGES, type GitErrorCode } from './shared/errors.ts'
import { credentialHintFor } from './shared/credentialHints.ts'

const HINTED_CODES = new Set<string>(['Authentication', 'Network'])

export function formatGitErrorToast(err: { code: string; message: string }): string {
  const message = err.message.trim() || DEFAULT_MESSAGES[err.code as GitErrorCode] || ''
  const hint = HINTED_CODES.has(err.code) ? credentialHintFor(err.code as GitErrorCode) : undefined
  return hint ? `${message} ${hint}` : message
}
