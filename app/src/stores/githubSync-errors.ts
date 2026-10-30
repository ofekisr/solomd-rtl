/** Does this error indicate the GitHub token is no longer valid (expired /
 *  revoked)? The Rust side surfaces `GitHub API 401 Unauthorized: {...Bad
 *  credentials...}`; match on either signal. Exported so the auto-sync glue
 *  reuses the exact same classification. */
export function isGithubAuthError(e: unknown): boolean {
  const s = String((e as { message?: string })?.message ?? e ?? '');
  return /\b401\b|bad credentials/i.test(s);
}

/** Classify push errors from the Rust backend. Returns a machine-readable tag. */
export type PushErrorType = 'none' | 'auth' | 'protected-branch' | 'non-fast-forward' | 'other';
export type PullErrorType = 'none' | 'auth' | 'conflict' | 'other';

export function classifyPushError(e: unknown): PushErrorType {
  if (isGithubAuthError(e)) return 'auth';
  const s = String(e);
  if (/protected branch/i.test(s) || /create a pull request/i.test(s)) return 'protected-branch';
  if (/non-fast-forward/i.test(s) || /pull first/i.test(s)) return 'non-fast-forward';
  return 'other';
}

export function classifyPullError(e: unknown): PullErrorType {
  if (isGithubAuthError(e)) return 'auth';
  const s = String(e);
  if (/conflict/i.test(s)) return 'conflict';
  return 'other';
}
