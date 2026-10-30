import type { PullErrorType, PushErrorType } from './githubSync-errors.ts';

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface GitHubRepo {
  name: string;
  full_name: string;
  clone_url: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  updated_at: string;
}

export interface SyncConfig {
  remote_url: string;
  auto_push: boolean;
  auto_pull_minutes: number;
  last_push_at: number | null;
  last_pull_at: number | null;
}

export interface SyncStatus {
  linked: boolean;
  remote_url: string;
  auto_push: boolean;
  auto_pull_minutes: number;
  encrypted: boolean;
  provider: string;
  ahead: number;
  behind: number;
  dirty: boolean;
  has_conflicts: boolean;
  conflicts: string[];
  last_push_at: number | null;
  last_pull_at: number | null;
}

export interface CryptoStatus {
  enabled: boolean;
  has_key: boolean;
}

export interface PullResult {
  kind: 'fast_forward' | 'up_to_date' | 'conflicts' | 'merged';
  conflicts: string[];
}

export interface State {
  hasToken: boolean;
  user: GitHubUser | null;
  repos: GitHubRepo[];
  folder: string | null;
  status: SyncStatus | null;
  loading: boolean;
  pushing: boolean;
  pulling: boolean;
  lastError: string | null;
  /** Set when GitHub rejects the stored token (401 / Bad credentials), i.e.
   *  the PAT expired or was revoked. Drives a "reconnect" banner + toast so the
   *  user isn't left staring at a raw `GitHub API 401` on their next sync. */
  tokenInvalid: boolean;
  /** Classified push error type after last failed push attempt. Reset on next push. */
  pushErrorType: PushErrorType;
  /** Classified pull error type after last failed pull attempt. Reset on next pull. */
  pullErrorType: PullErrorType;

  // Gitea-specific state
  giteaUrl: string;
  hasGiteaToken: boolean;
  giteaUser: GitHubUser | null;
  giteaRepos: GitHubRepo[];
  giteaLoading: boolean;
  giteaUrlValid: boolean | null;
  giteaTokenInvalid: boolean;
}
